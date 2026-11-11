package com.example.fixflow.service;

import java.time.Instant;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.example.fixflow.domain.TechnicianTermsAcceptance;
import com.example.fixflow.domain.UserRole;
import com.example.fixflow.repository.TechnicianContractApplicationRepository;
import com.example.fixflow.repository.TechnicianContractRepository;
import com.example.fixflow.repository.TechnicianTermsAcceptanceRepository;
import com.example.fixflow.repository.UserRepository;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.web.ApiException;

@Service
public class TechnicianTermsService {
    public record CurrentTerms(String currentVersion, String documentUrl) { }
    public CurrentTerms currentTerms() {
        return new CurrentTerms(version.isEmpty() ? null : version, documentUrl.isEmpty() ? null : documentUrl);
    }

    /** Self-contained terms page served when the platform has no external legal site. */
    public String documentHtml() {
        String current = version.isEmpty() ? "unpublished" : version;
        return """
                <!doctype html>
                <html lang="en"><head><meta charset="utf-8">
                <meta name="viewport" content="width=device-width,initial-scale=1">
                <title>FixFlow technician terms</title>
                <style>
                  :root { color-scheme: light; }
                  body { margin:0; background:#f2f7f6; color:#0f2e2b; font:15px/1.65 -apple-system,Segoe UI,Roboto,sans-serif; }
                  main { max-width:720px; margin:0 auto; padding:28px 20px 56px; }
                  h1 { font-size:24px; letter-spacing:-.4px; margin:0 0 4px; }
                  p.meta { color:#5b7a76; font-size:12px; margin:0 0 24px; }
                  section { background:#fff; border:1px solid #dbe7e4; border-radius:14px; padding:16px 18px; margin-bottom:12px; }
                  h2 { font-size:14px; margin:0 0 6px; }
                  p { margin:0; font-size:13px; color:#33514d; }
                </style></head><body><main>
                <h1>Technician terms of service</h1>
                <p class="meta">Version %s · Effective on acceptance</p>
                <section><h2>1. Scope</h2><p>These terms are the agreement between you and FixFlow for using the platform as a technician. Work at a specific site is also covered by that site's contract and rules.</p></section>
                <section><h2>2. Eligibility and verification</h2><p>Keep your platform verification current and complete the site vetting for every site you work on. Only accept work you are qualified and licensed to perform. A suspended or rejected account cannot claim reports, apply for contracts or accept marketplace offers.</p></section>
                <section><h2>3. Accepting work</h2><p>Claiming a report or accepting a marketplace offer commits you to attend within the site's service window. If you cannot attend, cancel in the app as early as possible so the reporter is not left waiting.</p></section>
                <section><h2>4. Safety on site</h2><p>Follow the site's rules, report hazards before you start, and stop work that becomes unsafe. Never start a job that requires a licence, permit or equipment you do not hold.</p></section>
                <section><h2>5. Evidence and completion</h2><p>Keep report status, photos and resolutions accurate. Marking a report resolved declares the work complete; the reporter may confirm it, rate it, or reopen it if the problem persists.</p></section>
                <section><h2>6. Payment</h2><p>Fees follow the agreement in force for the site where the work is done. Accepting these terms does not guarantee work, income or a contract, and FixFlow does not pay technicians unless a site agreement says otherwise.</p></section>
                <section><h2>7. Data and privacy</h2><p>Use reporter and site details only for the work assigned to you. Do not copy, forward or store that information outside the platform, and do not photograph people or property beyond what the report requires.</p></section>
                <section><h2>8. Suspension and changes</h2><p>Verification can be suspended for unsafe work, false submissions, missed attendance or misconduct. When these terms change, a new version is published and you must accept it before taking further work.</p></section>
                </main></body></html>
                """.formatted(current);
    }
    public record Acceptance(String version, String documentUrl, Instant acceptedAt) { }
    public record Status(Long technicianId, String currentVersion, String documentUrl,
            boolean enforcementRequired, boolean acceptedCurrentVersion, List<Acceptance> acceptances) { }
    private final TechnicianTermsAcceptanceRepository acceptances;
    private final UserRepository users;
    private final TechnicianContractRepository contracts;
    private final TechnicianContractApplicationRepository applications;
    private final String version;
    private final String documentUrl;
    private final boolean required;

    public TechnicianTermsService(TechnicianTermsAcceptanceRepository acceptances, UserRepository users,
            TechnicianContractRepository contracts, TechnicianContractApplicationRepository applications,
            @Value("${fixflow.technician-terms.version:}") String version,
            @Value("${fixflow.technician-terms.document-url:}") String documentUrl,
            @Value("${fixflow.technician-terms.required:false}") boolean required) {
        this.acceptances = acceptances; this.users = users; this.contracts = contracts; this.applications = applications;
        this.version = version.trim(); this.documentUrl = documentUrl.trim(); this.required = required;
        if (this.version.length() > 64 || this.documentUrl.length() > 1024
                || (required && (this.version.isEmpty() || this.documentUrl.isEmpty()))) {
            throw new IllegalArgumentException("Required technician terms need a version (max 64) and document URL (max 1024)");
        }
    }

    @Transactional(readOnly = true)
    public void requireAcceptance(Long technicianId) {
        if (!permitsWork(technicianId)) {
            throw new ApiException(409, "Technician must accept the current terms version before working or requesting a contract");
        }
    }

    /**
     * A technician may work once they accepted the published terms. Unpublished
     * terms fail closed (nobody can accept what does not exist); the platform
     * ships with a published default version so this only happens when an
     * operator deliberately clears the configuration.
     */
    @Transactional(readOnly = true)
    public boolean permitsWork(Long technicianId) {
        if (version.isEmpty() || documentUrl.isEmpty()) return false;
        return acceptances.existsByTechnician_IdAndTermsVersion(technicianId, version);
    }

    @Transactional
    public Status accept(String requestedVersion, AppUserDetails actor) {
        if (actor.getRole() != UserRole.technician) throw new ApiException(403, "Only technicians can accept technician terms");
        if (version.isEmpty() || documentUrl.isEmpty()) throw new ApiException(503, "Approved technician terms are not configured");
        if (!version.equals(requestedVersion)) throw new ApiException(409, "Terms version changed; review and accept the current version");
        var technician = users.findById(actor.getId()).orElseThrow(() -> new ApiException(401, "User not found"));
        if (technician.getRole() != UserRole.technician) throw new ApiException(403, "Only technicians can accept technician terms");
        if (!acceptances.existsByTechnician_IdAndTermsVersion(actor.getId(), version)) {
            TechnicianTermsAcceptance acceptance = new TechnicianTermsAcceptance();
            acceptance.setTechnician(technician); acceptance.setTermsVersion(version); acceptance.setDocumentUrl(documentUrl);
            acceptances.saveAndFlush(acceptance);
        }
        return status(actor.getId(), actor);
    }

    @Transactional(readOnly = true)
    public Status status(Long technicianId, AppUserDetails actor) {
        boolean self = actor.getRole() == UserRole.technician && actor.getId().equals(technicianId);
        boolean siteAdmin = actor.getRole() == UserRole.admin && actor.getSiteId() != null
                && (contracts.existsByTechnician_IdAndSite_Id(technicianId, actor.getSiteId())
                || applications.existsByTechnician_IdAndSite_Id(technicianId, actor.getSiteId()));
        if (!self && !siteAdmin && actor.getRole() != UserRole.super_admin) throw new ApiException(403, "Not allowed to view technician terms status");
        var technician = users.findById(technicianId).orElseThrow(() -> new ApiException(404, "Technician not found"));
        if (technician.getRole() != UserRole.technician) throw new ApiException(400, "User is not a technician");
        List<Acceptance> history = acceptances.findByTechnician_IdOrderByAcceptedAtDesc(technicianId).stream()
                .map(a -> new Acceptance(a.getTermsVersion(), a.getDocumentUrl(), a.getAcceptedAt())).toList();
        boolean published = !version.isEmpty() && !documentUrl.isEmpty();
        return new Status(technicianId, published ? version : null, published ? documentUrl : null,
                published, published && history.stream().anyMatch(a -> a.version().equals(version)), history);
    }
}

