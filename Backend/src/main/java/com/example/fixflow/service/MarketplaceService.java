package com.example.fixflow.service;

import com.example.fixflow.domain.*;
import com.example.fixflow.audit.*;
import com.example.fixflow.repository.*;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.web.ApiException;
import java.time.Duration;
import java.time.Instant;
import java.util.EnumSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(isolation = Isolation.READ_COMMITTED)
@RequiredArgsConstructor
public class MarketplaceService {
    private static final Set<MarketplaceListing.Status> LIVE =
            EnumSet.of(MarketplaceListing.Status.open, MarketplaceListing.Status.offered);
    private static final Set<ReportStatus> AVAILABLE =
            EnumSet.of(ReportStatus.open, ReportStatus.routed, ReportStatus.reopened, ReportStatus.escalated);
    private static final Set<ReportStatus> ACTIVE = EnumSet.of(ReportStatus.assigned, ReportStatus.in_progress,
            ReportStatus.reopened, ReportStatus.escalated, ReportStatus.resolved_pending_confirmation);
    private static final Duration LISTING_DURATION = Duration.ofDays(7);
    private static final Duration OFFER_DURATION = Duration.ofHours(24);

    private final MarketplaceListingRepository listings;
    private final MarketplaceApplicationRepository applications;
    private final MarketplaceAuditRepository audits;
    private final ReportRepository reports;
    private final UserRepository users;
    private final TechnicianVerificationRepository verifications;
    private final TechnicianSkillRepository skills;
    private final TechnicianTermsService terms;
    private final SiteVettingService vetting;
    private final ReportWorkflowService workflow;
    private final ReportRatingRepository ratings;

    public record ListingView(Long id, String summary, String broadLocation, String timing,
            String category, String specialty, long amountMinor, String currency, Urgency urgency,
            MarketplaceListing.Status status, Instant expiresAt, Long reportId, ApplicationView myApplication,
            boolean canCancelAssignment, List<ApplicationView> applications) { }

    public record ApplicationView(Long id, Long technicianId, String technicianName, String note,
            Long proposedAmountMinor, MarketplaceApplication.Status status, Instant offerExpiresAt,
            long activeCases, long completedJobs, Double averageRating, String reviewedTrades,
            String reviewedQualifications, long cancellations) { }

    @Transactional(readOnly = true)
    public List<ListingView> list(AppUserDetails actor) {
        Instant now = Instant.now();
        if (actor.getRole() == UserRole.super_admin) {
            return adminListingViews(listings.findAllWithReportOrderByIdDesc(), now);
        }
        if (actor.getRole() == UserRole.admin) {
            return adminListingViews(listings.findByReport_Site_IdOrderByIdDesc(adminSiteId(actor)), now);
        }
        requireTechnician(actor);
        List<TechnicianSkill> mySkills = skills.findByTechnician_IdInOrderByIdAsc(List.of(actor.getId()));
        return listings.findForTechnician(actor.getId()).stream().flatMap(listing -> {
            var mine = applications.findByListing_IdAndTechnician_Id(listing.getId(), actor.getId()).orElse(null);
            // Open jobs are limited to the technician's trade skills. Own
            // applications stay visible so offer/accept history is not lost.
            // Verification and terms remain enforced when applying.
            if (mine == null && listingStatus(listing, now) != MarketplaceListing.Status.open) {
                return java.util.stream.Stream.empty();
            }
            if (mine == null && !matchesListing(listing, mySkills)) {
                return java.util.stream.Stream.empty();
            }
            return java.util.stream.Stream.of(listingView(listing, mine, false, now, List.of()));
        }).toList();
    }

    private List<ListingView> adminListingViews(List<MarketplaceListing> values, Instant now) {
        if (values.isEmpty()) return List.of();
        var byListing = applications.findDetailedByListingIdIn(values.stream().map(MarketplaceListing::getId).toList())
                .stream().collect(java.util.stream.Collectors.groupingBy(application -> application.getListing().getId()));
        return values.stream().map(listing -> listingView(listing, null, true, now,
                byListing.getOrDefault(listing.getId(), List.of()).stream()
                        .map(application -> applicationView(application, true, now)).toList())).toList();
    }

    public ListingView publish(Long reportId, String summary, String broadLocation, String timing, long amountMinor,
            String currency, AppUserDetails actor) {
        Report report = lockReport(reportId);
        requireAdmin(report, actor);
        requireAvailable(report);
        if (amountMinor <= 0) throw new ApiException(400, "Amount must be greater than zero");
        Instant now = Instant.now();
        for (MarketplaceListing existing : listings.findByReport_IdAndStatusIn(reportId, LIVE)) {
            reconcile(existing, now);
            if (LIVE.contains(existing.getStatus())) throw conflict("This report already has a marketplace listing");
        }
        MarketplaceListing listing = new MarketplaceListing();
        listing.setReport(report);
        listing.setSummary(summary.trim());
        listing.setBroadLocation(broadLocation.trim());
        listing.setTiming(timing.trim());
        listing.setCategory(report.getCategory());
        listing.setSpecialty(report.getSpecialty());
        listing.setAmountMinor(amountMinor);
        listing.setCurrency(currency == null || currency.isBlank() ? "USD" : currency.trim().toUpperCase());
        listing.setExpiresAt(now.plus(LISTING_DURATION));
        listings.save(listing);
        audit(listing, null, actor.getId(), "published", now);
        return listingView(listing, null, true, now, List.of());
    }

    public ListingView close(Long id, AppUserDetails actor) {
        MarketplaceListing listing = lockedListing(id);
        requireAdmin(listing.getReport(), actor);
        Instant now = Instant.now();
        reconcile(listing, now);
        if (listing.getStatus() == MarketplaceListing.Status.assigned) throw conflict("An awarded listing cannot be closed");
        if (LIVE.contains(listing.getStatus())) finish(listing, MarketplaceListing.Status.closed, actor.getId(), now);
        return adminListingView(listing, now);
    }

    public ListingView cancelAssignment(Long id, String reason, AppUserDetails actor) {
        MarketplaceListing listing = lockedListing(id);
        Report report = listing.getReport();
        requireAdmin(report, actor);
        if (!canCancelAssignment(listing)) {
            throw conflict("Only active marketplace assignments without a pending resolution may be cancelled");
        }
        MarketplaceApplication award = applications.findByListing_IdAndTechnician_Id(id, report.getAssignedTechnician().getId())
                .filter(application -> application.getStatus() == MarketplaceApplication.Status.accepted)
                .orElseThrow(() -> conflict("The report assignment has already changed"));
        workflow.cancelMarketplaceAssignment(report, actor, reason.trim());
        listing.setStatus(MarketplaceListing.Status.closed);
        award.setStatus(MarketplaceApplication.Status.cancelled);
        audit(listing, award, actor.getId(), "assignment_cancelled", Instant.now());
        return adminListingView(listing, Instant.now());
    }

    private ListingView adminListingView(MarketplaceListing listing, Instant now) {
        return listingView(listing, null, true, now, applications.findDetailedByListingId(listing.getId()).stream()
                .map(application -> applicationView(application, true, now)).toList());
    }

    @Transactional(readOnly = true)
    public List<ApplicationView> applicants(Long id, AppUserDetails actor) {
        MarketplaceListing listing = foundListing(id);
        requireAdmin(listing.getReport(), actor);
        Instant now = Instant.now();
        return applications.findDetailedByListingId(id).stream()
                .map(application -> applicationView(application, true, now)).toList();
    }

    public ApplicationView apply(Long id, String note, Long proposedAmountMinor, AppUserDetails actor) {
        requireTechnician(actor);
        MarketplaceListing listing = lockedListing(id);
        Instant now = Instant.now();
        reconcile(listing, now);
        if (listing.getStatus() != MarketplaceListing.Status.open) throw conflict("Listing is not open to applications");
        User technician = requireEligible(listing, actor.getId());
        if (applications.findByListing_IdAndTechnician_Id(id, actor.getId()).isPresent()) {
            throw conflict("You already applied for this listing");
        }
        if (proposedAmountMinor != null && proposedAmountMinor <= 0) {
            throw new ApiException(400, "Proposed amount must be greater than zero");
        }
        MarketplaceApplication application = new MarketplaceApplication();
        application.setListing(listing);
        application.setTechnician(technician);
        application.setNote(note.trim());
        application.setProposedAmountMinor(proposedAmountMinor);
        applications.save(application);
        audit(listing, application, actor.getId(), "applied", now);
        return applicationView(application, false, now);
    }

    public ApplicationView counter(Long id, Long applicationId, long amountMinor, String note, AppUserDetails actor) {
        requireTechnician(actor);
        MarketplaceListing listing = lockedListing(id);
        MarketplaceApplication application = ownApplication(id, applicationId, actor);
        Instant now = Instant.now();
        reconcile(listing, now);
        if (application.getStatus() != MarketplaceApplication.Status.offered
                && application.getStatus() != MarketplaceApplication.Status.pending) {
            throw conflict("Only pending or offered applications can be negotiated");
        }
        if (amountMinor <= 0) throw new ApiException(400, "Counter amount must be greater than zero");
        application.setProposedAmountMinor(amountMinor);
        if (note != null && !note.isBlank()) application.setNote(note.trim());
        if (application.getStatus() == MarketplaceApplication.Status.offered) {
            listing.setStatus(MarketplaceListing.Status.open);
            application.setStatus(MarketplaceApplication.Status.pending);
            application.setOfferExpiresAt(null);
        }
        audit(listing, application, actor.getId(), "countered", now);
        return applicationView(application, false, now);
    }

    public ApplicationView select(Long id, Long applicationId, boolean safetyConfirmed, AppUserDetails actor) {
        MarketplaceListing listing = lockedListing(id);
        requireAdmin(listing.getReport(), actor);
        Instant now = Instant.now();
        reconcile(listing, now);
        MarketplaceApplication application = foundApplication(id, applicationId);
        if (listing.getStatus() != MarketplaceListing.Status.open
                || application.getStatus() != MarketplaceApplication.Status.pending) {
            throw conflict("Listing and application must be open for selection");
        }
        if (!safetyConfirmed) throw conflict("Confirm trade suitability and site access requirements before selection");
        requireEligible(listing, application.getTechnician().getId());
        vetting.requireEligible(application.getTechnician().getId(), listing.getReport().getSite().getId());
        listing.setStatus(MarketplaceListing.Status.offered);
        application.setStatus(MarketplaceApplication.Status.offered);
        Instant offerExpiry = now.plus(OFFER_DURATION);
        application.setOfferExpiresAt(offerExpiry.isBefore(listing.getExpiresAt()) ? offerExpiry : listing.getExpiresAt());
        audit(listing, application, actor.getId(), "selected_safety_confirmed", now);
        return applicationView(application, true, now);
    }

    public ApplicationView accept(Long id, Long applicationId, AppUserDetails actor) {
        requireTechnician(actor);
        MarketplaceListing listing = lockedListing(id);
        MarketplaceApplication application = ownApplication(id, applicationId, actor);
        Instant now = Instant.now();
        reconcile(listing, now);
        requireOffer(listing, application);
        User technician = requireEligible(listing, actor.getId());
        Report report = listing.getReport();
        vetting.requireEligible(actor.getId(), report.getSite().getId());
        requireAvailable(report);
        long agreed = application.getProposedAmountMinor() != null
                ? application.getProposedAmountMinor()
                : listing.getAmountMinor();
        report.setAgreedAmountMinor(agreed);
        report.setAgreedCurrency(listing.getCurrency());
        workflow.activateMarketplaceAssignment(report, technician, actor);
        listing.setStatus(MarketplaceListing.Status.assigned);
        application.setStatus(MarketplaceApplication.Status.accepted);
        audit(listing, application, actor.getId(), "accepted", now);
        for (MarketplaceApplication other : applications.findByListing_IdOrderByIdAsc(id)) {
            if (other.getStatus() == MarketplaceApplication.Status.pending) {
                other.setStatus(MarketplaceApplication.Status.rejected);
                audit(listing, other, actor.getId(), "not_selected", now);
            }
        }
        return applicationView(application, false, now);
    }

    public ApplicationView leave(Long id, Long applicationId, boolean decline, AppUserDetails actor) {
        requireTechnician(actor);
        MarketplaceListing listing = lockedListing(id);
        MarketplaceApplication application = ownApplication(id, applicationId, actor);
        Instant now = Instant.now();
        reconcile(listing, now);
        if (decline) {
            requireOffer(listing, application);
            listing.setStatus(MarketplaceListing.Status.open);
            application.setStatus(MarketplaceApplication.Status.declined);
        } else {
            if (!LIVE.contains(listing.getStatus()) || application.getStatus() != MarketplaceApplication.Status.pending) {
                throw conflict("Only pending applications may be withdrawn");
            }
            application.setStatus(MarketplaceApplication.Status.withdrawn);
        }
        audit(listing, application, actor.getId(), application.getStatus().name(), now);
        return applicationView(application, false, now);
    }

    private void reconcile(MarketplaceListing listing, Instant now) {
        if (!LIVE.contains(listing.getStatus())) return;
        var effective = listingStatus(listing, now);
        if (effective == MarketplaceListing.Status.closed || effective == MarketplaceListing.Status.expired) {
            finish(listing, effective, null, now);
        } else if (listing.getStatus() == MarketplaceListing.Status.offered && effective == MarketplaceListing.Status.open) {
            MarketplaceApplication offer = currentOffer(listing);
            if (offer != null) {
                offer.setStatus(MarketplaceApplication.Status.expired);
                audit(listing, offer, null, "offer_expired", now);
            }
            listing.setStatus(MarketplaceListing.Status.open);
        }
    }

    private void finish(MarketplaceListing listing, MarketplaceListing.Status status, Long actor, Instant now) {
        listing.setStatus(status);
        for (MarketplaceApplication application : applications.findByListing_IdOrderByIdAsc(listing.getId())) {
            if (application.getStatus() == MarketplaceApplication.Status.pending
                    || application.getStatus() == MarketplaceApplication.Status.offered) {
                application.setStatus(status == MarketplaceListing.Status.expired
                        ? MarketplaceApplication.Status.expired : MarketplaceApplication.Status.rejected);
                audit(listing, application, actor, application.getStatus().name(), now);
            }
        }
        audit(listing, null, actor, status.name(), now);
    }

    private MarketplaceListing.Status listingStatus(MarketplaceListing listing, Instant now) {
        if (!LIVE.contains(listing.getStatus())) return listing.getStatus();
        if (!listing.getExpiresAt().isAfter(now)) return MarketplaceListing.Status.expired;
        Report report = listing.getReport();
        if (!available(report) || !Objects.equals(report.getCategory(), listing.getCategory())
                || !Objects.equals(report.getSpecialty(), listing.getSpecialty())) {
            return MarketplaceListing.Status.closed;
        }
        if (listing.getStatus() == MarketplaceListing.Status.offered) {
            MarketplaceApplication offer = currentOffer(listing);
            if (offer == null || !offer.getOfferExpiresAt().isAfter(now)) return MarketplaceListing.Status.open;
        }
        return listing.getStatus();
    }

    private MarketplaceApplication currentOffer(MarketplaceListing listing) {
        return applications.findByListing_IdOrderByIdAsc(listing.getId()).stream()
                .filter(application -> application.getStatus() == MarketplaceApplication.Status.offered)
                .findFirst().orElse(null);
    }

    private ListingView listingView(MarketplaceListing listing, MarketplaceApplication mine, boolean admin, Instant now,
            List<ApplicationView> applications) {
        Report report = listing.getReport();
        boolean awarded = mine != null && mine.getStatus() == MarketplaceApplication.Status.accepted
                && report.getAssignedTechnician() != null
                && report.getAssignedTechnician().getId().equals(mine.getTechnician().getId());
        return new ListingView(listing.getId(), listing.getSummary(), listing.getBroadLocation(), listing.getTiming(),
                listing.getCategory(), admin || awarded ? listing.getSpecialty() : null,
                listing.getAmountMinor(), listing.getCurrency(),
                report.getEffectiveUrgency(), listingStatus(listing, now),
                listing.getExpiresAt(), admin || awarded ? report.getId() : null,
                mine == null ? null : applicationView(mine, false, now), admin && canCancelAssignment(listing),
                applications);
    }

    private boolean canCancelAssignment(MarketplaceListing listing) {
        Report report = listing.getReport();
        return listing.getStatus() == MarketplaceListing.Status.assigned
                && report.getAssignedTechnician() != null
                && report.getStatus() != ReportStatus.resolved_pending_confirmation
                && report.getStatus() != ReportStatus.confirmed
                && applications.findByListing_IdAndTechnician_Id(listing.getId(), report.getAssignedTechnician().getId())
                        .filter(application -> application.getStatus() == MarketplaceApplication.Status.accepted).isPresent();
    }
    private ApplicationView applicationView(MarketplaceApplication application, boolean admin, Instant now) {
        User technician = application.getTechnician();
        Long id = technician.getId();
        var status = application.getStatus();
        if (status == MarketplaceApplication.Status.pending || status == MarketplaceApplication.Status.offered) {
            var listing = application.getListing();
            var state = listingStatus(listing, now);
            if (state == MarketplaceListing.Status.closed) status = MarketplaceApplication.Status.rejected;
            if (state == MarketplaceListing.Status.expired || status == MarketplaceApplication.Status.offered
                    && !application.getOfferExpiresAt().isAfter(now)) status = MarketplaceApplication.Status.expired;
        }
        var evidence = admin ? verifications.findById(id).orElse(null) : null;
        return new ApplicationView(application.getId(), id, technician.getFirstName() + " " + technician.getLastName(),
                application.getNote(), application.getProposedAmountMinor(), status, application.getOfferExpiresAt(),
                admin ? reports.countByAssignedTechnician_IdAndStatusIn(id, ACTIVE) : 0,
                admin ? reports.countByAssignedTechnician_IdAndStatus(id, ReportStatus.confirmed) : 0,
                admin ? ratings.averageConfirmedScore(id, ReportStatus.confirmed) : null,
                evidence == null ? null : evidence.getTrades(), evidence == null ? null : evidence.getQualifications(),
                admin ? applications.countByTechnician_IdAndStatus(id, MarketplaceApplication.Status.cancelled) : 0);
    }

    private User requireEligible(MarketplaceListing listing, Long id) {
        User technician = users.findById(id).filter(user -> user.getRole() == UserRole.technician)
                .orElseThrow(() -> denied("Only technicians can apply"));
        if (verifications.findForMarketplace(id).filter(this::manualChecks).isEmpty()) {
            throw denied("Current manual technician verification is required");
        }
        terms.requireAcceptance(id);
        if (!matches(listing.getReport(), skills.findByTechnician_IdInOrderByIdAsc(List.of(id)))) {
            throw denied("Technician skills do not match this listing");
        }
        return technician;
    }

    private boolean manualChecks(TechnicianVerification verification) {
        return "verified".equals(verification.getStatus()) && verification.isIdentityChecked()
                && verification.isEmailChecked() && verification.isPhoneChecked() && verification.isTradeChecked()
                && verification.getTrades() != null && !verification.getTrades().isBlank();
    }

    private boolean matches(Report report, List<TechnicianSkill> technicianSkills) {
        return matchesTrade(report.getCategory(), report.getSpecialty(), technicianSkills);
    }

    private boolean matchesListing(MarketplaceListing listing, List<TechnicianSkill> technicianSkills) {
        return matchesTrade(listing.getCategory(), listing.getSpecialty(), technicianSkills);
    }

    /** Category must match; specialty must match when the job specifies one. */
    private boolean matchesTrade(String category, String specialty, List<TechnicianSkill> technicianSkills) {
        if (technicianSkills.isEmpty() || category == null || category.isBlank()) {
            return false;
        }
        boolean requireSpecialty = specialty != null && !specialty.isBlank();
        return technicianSkills.stream().anyMatch(skill ->
                skill.getCategory().equalsIgnoreCase(category)
                        && (!requireSpecialty || specialty.equalsIgnoreCase(skill.getSpecialty())));
    }

    private MarketplaceListing lockedListing(Long id) {
        Long reportId = listings.findReportId(id).orElseThrow(() -> new ApiException(404, "Marketplace listing not found"));
        lockReport(reportId);
        return foundListing(id);
    }

    private Report lockReport(Long id) {
        return reports.findForVisionUpdate(id).orElseThrow(() -> new ApiException(404, "Report not found"));
    }

    private MarketplaceListing foundListing(Long id) {
        return listings.findById(id).orElseThrow(() -> new ApiException(404, "Marketplace listing not found"));
    }

    private MarketplaceApplication foundApplication(Long id, Long applicationId) {
        return applications.findByIdAndListing_Id(applicationId, id)
                .orElseThrow(() -> new ApiException(404, "Marketplace application not found"));
    }

    private MarketplaceApplication ownApplication(Long id, Long applicationId, AppUserDetails actor) {
        MarketplaceApplication application = foundApplication(id, applicationId);
        if (!application.getTechnician().getId().equals(actor.getId())) throw denied("Application belongs to another technician");
        return application;
    }

    private boolean available(Report report) {
        return report.getAssignedTechnician() == null && AVAILABLE.contains(report.getStatus());
    }

    private void requireAvailable(Report report) {
        if (!available(report)) throw conflict("Report is unavailable for a marketplace assignment");
    }

    private void requireOffer(MarketplaceListing listing, MarketplaceApplication application) {
        if (listing.getStatus() != MarketplaceListing.Status.offered
                || application.getStatus() != MarketplaceApplication.Status.offered) {
            throw conflict("The application has no active offer");
        }
    }

    private void requireAdmin(Report report, AppUserDetails actor) {
        if (actor.getRole() == UserRole.super_admin) return;
        if (!report.getSite().getId().equals(adminSiteId(actor))) {
            throw denied("Only the report site's administrator can manage this listing");
        }
    }

    private Long adminSiteId(AppUserDetails actor) {
        if (actor.getRole() != UserRole.admin || actor.getSiteId() == null) {
            throw denied("Only the report site's administrator can manage this listing");
        }
        return users.findWithSiteById(actor.getId())
                .filter(user -> user.getRole() == UserRole.admin && user.getSite() != null
                        && user.getSite().getId().equals(actor.getSiteId()))
                .map(user -> user.getSite().getId())
                .orElseThrow(() -> denied("Current site administrator access is required"));
    }

    private void requireTechnician(AppUserDetails actor) {
        if (actor.getRole() != UserRole.technician) throw denied("Only technicians can use this marketplace action");
    }

    private void audit(MarketplaceListing listing, MarketplaceApplication application, Long actor, String action, Instant now) {
        audits.save(new MarketplaceAudit(listing.getId(), application == null ? null : application.getId(), actor, action, now));
    }

    private ApiException conflict(String message) {
        return new ApiException(409, message);
    }

    private ApiException denied(String message) {
        return new ApiException(403, message);
    }
}
