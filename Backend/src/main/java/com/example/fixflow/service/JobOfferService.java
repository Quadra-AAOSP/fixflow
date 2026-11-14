package com.example.fixflow.service;

import java.util.EnumSet;
import java.util.List;
import java.util.Locale;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.fixflow.domain.JobOffer;
import com.example.fixflow.domain.Report;
import com.example.fixflow.domain.User;
import com.example.fixflow.domain.UserRole;
import com.example.fixflow.dto.AssignTechnicianRequest;
import com.example.fixflow.repository.JobOfferRepository;
import com.example.fixflow.repository.ReportRepository;
import com.example.fixflow.repository.TechnicianContractRepository;
import com.example.fixflow.repository.UserRepository;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.web.ApiException;

@Service
@Transactional
public class JobOfferService {

	private static final EnumSet<JobOffer.Status> OPEN = EnumSet.of(JobOffer.Status.pending, JobOffer.Status.countered);

	private final JobOfferRepository offers;
	private final ReportRepository reports;
	private final UserRepository users;
	private final TechnicianContractRepository contracts;
	private final ReportService reportService;
	private final SiteVettingService vetting;
	private final RoleIntegrityService roleIntegrity;

	public JobOfferService(
			JobOfferRepository offers,
			ReportRepository reports,
			UserRepository users,
			TechnicianContractRepository contracts,
			ReportService reportService,
			SiteVettingService vetting,
			RoleIntegrityService roleIntegrity) {
		this.offers = offers;
		this.reports = reports;
		this.users = users;
		this.contracts = contracts;
		this.reportService = reportService;
		this.vetting = vetting;
		this.roleIntegrity = roleIntegrity;
	}

	public record OfferView(
			Long id,
			Long reportId,
			Long technicianId,
			String technicianName,
			long amountMinor,
			String currency,
			Long counterAmountMinor,
			String status,
			String note,
			java.time.Instant createdAt,
			java.time.Instant updatedAt) {
	}

	public List<OfferView> forReport(Long reportId, AppUserDetails actor) {
		Report report = reports.findDetailedById(reportId)
				.orElseThrow(() -> new ApiException(404, "Report not found"));
		assertCanViewOffers(report, actor);
		return offers.findByReport_IdOrderByIdDesc(reportId).stream().map(this::view).toList();
	}

	public List<OfferView> mine(AppUserDetails actor) {
		if (actor.getRole() != UserRole.technician) {
			throw new ApiException(403, "Technician access required");
		}
		return offers.findByTechnician_IdOrderByIdDesc(actor.getId()).stream().map(this::view).toList();
	}

	/** Admin creates a paid assignment offer; assignment activates only after accept. */
	public OfferView create(Long reportId, long amountMinor, String currency, Long technicianId, String note,
			AppUserDetails actor) {
		requireManager(actor);
		if (amountMinor <= 0) {
			throw new ApiException(400, "Amount must be greater than zero");
		}
		Report report = reports.findForVisionUpdate(reportId)
				.orElseThrow(() -> new ApiException(404, "Report not found"));
		assertSameSite(actor, report);
		User technician = users.findById(technicianId)
				.orElseThrow(() -> new ApiException(400, "Technician not found"));
		roleIntegrity.requireTechnician(technician);
		if (!contracts.existsByTechnician_IdAndSite_Id(technician.getId(), report.getSite().getId())) {
			throw new ApiException(409, "Technician must have a contract with the report's site");
		}
		vetting.requireEligible(technician.getId(), report.getSite().getId());
		if (report.getAssignedTechnician() != null
				&& report.getAssignedTechnician().getId().equals(technician.getId())) {
			throw new ApiException(409, "Technician is already assigned to this report");
		}
		for (JobOffer open : offers.findByReport_IdAndStatusIn(reportId, List.copyOf(OPEN))) {
			open.setStatus(JobOffer.Status.cancelled);
		}
		JobOffer offer = new JobOffer();
		offer.setReport(report);
		offer.setTechnician(technician);
		offer.setAmountMinor(amountMinor);
		offer.setCurrency(normalizeCurrency(currency));
		offer.setNote(blankToNull(note));
		offer.setStatus(JobOffer.Status.pending);
		offer.setCreatedBy(users.findById(actor.getId()).orElseThrow());
		return view(offers.save(offer));
	}

	public OfferView accept(Long reportId, Long offerId, AppUserDetails actor) {
		JobOffer offer = requireOpenOffer(reportId, offerId);
		boolean manager = isManager(actor);
		boolean technician = actor.getRole() == UserRole.technician && actor.getId().equals(offer.getTechnician().getId());
		if (!manager && !technician) {
			throw new ApiException(403, "Only the offered technician or a site manager may accept");
		}
		long agreed = offer.getStatus() == JobOffer.Status.countered && offer.getCounterAmountMinor() != null
				? offer.getCounterAmountMinor()
				: offer.getAmountMinor();
		if (offer.getStatus() == JobOffer.Status.countered) {
			if (!manager) {
				throw new ApiException(409, "Waiting for the administrator to accept or reject the counter offer");
			}
			offer.setAmountMinor(agreed);
			offer.setCounterAmountMinor(null);
		} else if (!technician) {
			throw new ApiException(409, "Only the technician can accept the initial offer");
		}
		offer.setStatus(JobOffer.Status.accepted);
		Report report = offer.getReport();
		report.setAgreedAmountMinor(agreed);
		report.setAgreedCurrency(offer.getCurrency());
		reports.save(report);
		// Assign under the offer creator so technicians cannot call assign directly.
		AppUserDetails assignActor = new AppUserDetails(offer.getCreatedBy());
		reportService.assign(reportId, new AssignTechnicianRequest(offer.getTechnician().getId()), assignActor);
		return view(offer);
	}

	public OfferView reject(Long reportId, Long offerId, String note, AppUserDetails actor) {
		JobOffer offer = requireOpenOffer(reportId, offerId);
		assertParticipant(offer, actor);
		offer.setStatus(JobOffer.Status.rejected);
		if (note != null && !note.isBlank()) {
			offer.setNote(note.trim());
		}
		return view(offer);
	}

	public OfferView counter(Long reportId, Long offerId, long amountMinor, String note, AppUserDetails actor) {
		if (amountMinor <= 0) {
			throw new ApiException(400, "Counter amount must be greater than zero");
		}
		JobOffer offer = requireOpenOffer(reportId, offerId);
		assertParticipant(offer, actor);
		offer.setCounterAmountMinor(amountMinor);
		offer.setStatus(JobOffer.Status.countered);
		offer.setNote(blankToNull(note));
		return view(offer);
	}

	private JobOffer requireOpenOffer(Long reportId, Long offerId) {
		JobOffer offer = offers.findByIdAndReport_Id(offerId, reportId)
				.orElseThrow(() -> new ApiException(404, "Job offer not found"));
		if (!OPEN.contains(offer.getStatus())) {
			throw new ApiException(409, "Offer is no longer open");
		}
		return offer;
	}

	private void assertParticipant(JobOffer offer, AppUserDetails actor) {
		if (actor.getRole() == UserRole.technician && actor.getId().equals(offer.getTechnician().getId())) {
			return;
		}
		if (isManager(actor)) {
			assertSameSite(actor, offer.getReport());
			return;
		}
		throw new ApiException(403, "Not allowed to update this offer");
	}

	private void assertCanViewOffers(Report report, AppUserDetails actor) {
		if (actor.getRole() == UserRole.technician) {
			return;
		}
		requireManager(actor);
		assertSameSite(actor, report);
	}

	private void requireManager(AppUserDetails actor) {
		if (!isManager(actor)) {
			throw new ApiException(403, "Only staff or admin can manage job offers");
		}
	}

	private boolean isManager(AppUserDetails actor) {
		return actor.getRole() == UserRole.admin
				|| actor.getRole() == UserRole.staff
				|| actor.getRole() == UserRole.super_admin;
	}

	private void assertSameSite(AppUserDetails actor, Report report) {
		if (actor.getRole() == UserRole.super_admin) {
			return;
		}
		if (actor.getSiteId() == null || !actor.getSiteId().equals(report.getSite().getId())) {
			throw new ApiException(403, "Cannot manage offers for another site");
		}
	}

	private OfferView view(JobOffer offer) {
		User technician = offer.getTechnician();
		String name = ((technician.getFirstName() == null ? "" : technician.getFirstName()) + " "
				+ (technician.getLastName() == null ? "" : technician.getLastName())).trim();
		return new OfferView(
				offer.getId(),
				offer.getReport().getId(),
				technician.getId(),
				name.isEmpty() ? ("#" + technician.getId()) : name,
				offer.getAmountMinor(),
				offer.getCurrency(),
				offer.getCounterAmountMinor(),
				offer.getStatus().name(),
				offer.getNote(),
				offer.getCreatedAt(),
				offer.getUpdatedAt());
	}

	private static String normalizeCurrency(String currency) {
		if (currency == null || currency.isBlank()) {
			return "USD";
		}
		String value = currency.trim().toUpperCase(Locale.ROOT);
		if (value.length() < 3 || value.length() > 8) {
			throw new ApiException(400, "Currency must be 3–8 characters");
		}
		return value;
	}

	private static String blankToNull(String note) {
		return note == null || note.isBlank() ? null : note.trim();
	}
}
