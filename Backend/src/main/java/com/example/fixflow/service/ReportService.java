package com.example.fixflow.service;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.fixflow.domain.Report;
import com.example.fixflow.domain.ReportReporter;
import com.example.fixflow.domain.ReportStatus;
import com.example.fixflow.domain.Site;
import com.example.fixflow.domain.User;
import com.example.fixflow.domain.UserRole;
import com.example.fixflow.dto.AssignTechnicianRequest;
import com.example.fixflow.dto.CreateReportRequest;
import com.example.fixflow.dto.ReportReporterResponse;
import com.example.fixflow.dto.ReportResponse;
import com.example.fixflow.repository.ReportReporterRepository;
import com.example.fixflow.repository.ReportRepository;
import com.example.fixflow.repository.SiteRepository;
import com.example.fixflow.repository.UserRepository;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.web.ApiException;

@Service
public class ReportService {

	private final ReportRepository reportRepository;
	private final ReportReporterRepository reportReporterRepository;
	private final UserRepository userRepository;
	private final SiteRepository siteRepository;
	private final CategoryTaxonomyService categoryTaxonomyService;
	private final RoleIntegrityService roleIntegrityService;

	public ReportService(
			ReportRepository reportRepository,
			ReportReporterRepository reportReporterRepository,
			UserRepository userRepository,
			SiteRepository siteRepository,
			CategoryTaxonomyService categoryTaxonomyService,
			RoleIntegrityService roleIntegrityService
	) {
		this.reportRepository = reportRepository;
		this.reportReporterRepository = reportReporterRepository;
		this.userRepository = userRepository;
		this.siteRepository = siteRepository;
		this.categoryTaxonomyService = categoryTaxonomyService;
		this.roleIntegrityService = roleIntegrityService;
	}

	@Transactional
	public ReportResponse create(CreateReportRequest request, AppUserDetails actor) {
		User filer = loadUser(actor.getId());
		if (filer.getRole() != UserRole.reporter
				&& filer.getRole() != UserRole.staff
				&& filer.getRole() != UserRole.admin
				&& filer.getRole() != UserRole.super_admin) {
			throw new ApiException(HttpStatus.FORBIDDEN.value(), "This role cannot create reports");
		}

		Site site = resolveSiteForCreate(filer, request.siteId());
		String category = categoryTaxonomyService.requireAllowedCategory(site.getType(), request.category());

		Report report = new Report();
		report.setSite(site);
		report.setCreatedBy(filer);
		report.setDescription(request.description().trim());
		report.setAddress(blankToNull(request.address()));
		report.setCategory(category);
		report.setSpecialty(blankToNull(request.specialty()));
		report.setReporterUrgency(request.reporterUrgency());
		report.setReporterReason(blankToNull(request.reporterReason()));
		report.setStatus(ReportStatus.open);
		report = reportRepository.save(report);

		ReportReporter attachment = new ReportReporter();
		attachment.setReportId(report.getId());
		attachment.setUserId(filer.getId());
		reportReporterRepository.save(attachment);

		return ReportResponse.from(report, true);
	}

	@Transactional(readOnly = true)
	public List<ReportResponse> list(Long siteId, AppUserDetails actor) {
		Long scopedSiteId = resolveSiteForList(actor, siteId);
		return reportRepository.findDetailedBySiteId(scopedSiteId).stream()
				.map(report -> ReportResponse.from(report, canSeeSensitive(actor, report)))
				.toList();
	}

	@Transactional(readOnly = true)
	public ReportResponse get(Long id, AppUserDetails actor) {
		Report report = reportRepository.findDetailedById(id)
				.orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND.value(), "Report not found"));
		assertCanViewSite(actor, report.getSite().getId());
		return ReportResponse.from(report, canSeeSensitive(actor, report));
	}

	@Transactional
	public ReportResponse join(Long id, AppUserDetails actor) {
		Report report = reportRepository.findDetailedById(id)
				.orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND.value(), "Report not found"));
		assertCanViewSite(actor, report.getSite().getId());
		if (!reportReporterRepository.existsByReportIdAndUserId(id, actor.getId())) {
			ReportReporter attachment = new ReportReporter();
			attachment.setReportId(id);
			attachment.setUserId(actor.getId());
			reportReporterRepository.save(attachment);
		}
		return ReportResponse.from(report, true);
	}

	@Transactional(readOnly = true)
	public List<ReportReporterResponse> listReporters(Long id, AppUserDetails actor) {
		Report report = reportRepository.findDetailedById(id)
				.orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND.value(), "Report not found"));
		assertCanViewSite(actor, report.getSite().getId());
		if (!canSeeSensitive(actor, report)) {
			throw new ApiException(HttpStatus.FORBIDDEN.value(), "Not allowed to list reporters on this report");
		}
		return reportReporterRepository.findByReportIdOrderByJoinedAtAsc(id).stream()
				.map(row -> new ReportReporterResponse(row.getReportId(), row.getUserId(), row.getJoinedAt()))
				.toList();
	}

	@Transactional
	public ReportResponse assign(Long id, AssignTechnicianRequest request, AppUserDetails actor) {
		if (actor.getRole() != UserRole.admin
				&& actor.getRole() != UserRole.staff
				&& actor.getRole() != UserRole.super_admin) {
			throw new ApiException(HttpStatus.FORBIDDEN.value(), "Only staff or admin can assign technicians");
		}
		Report report = reportRepository.findDetailedById(id)
				.orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND.value(), "Report not found"));
		assertCanViewSite(actor, report.getSite().getId());
		User technician = userRepository.findById(request.technicianId())
				.orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST.value(), "Technician not found"));
		roleIntegrityService.requireTechnician(technician);
		report.setAssignedTechnician(technician);
		report.setStatus(ReportStatus.assigned);
		return ReportResponse.from(reportRepository.save(report), true);
	}

	private Site resolveSiteForCreate(User filer, Long requestedSiteId) {
		if (filer.getRole() == UserRole.super_admin) {
			if (requestedSiteId == null) {
				throw new ApiException(HttpStatus.BAD_REQUEST.value(), "super_admin must supply siteId");
			}
			return siteRepository.findById(requestedSiteId)
					.orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST.value(), "Site not found"));
		}
		if (filer.getSite() == null) {
			throw new ApiException(HttpStatus.BAD_REQUEST.value(), "Account is not scoped to a site");
		}
		if (requestedSiteId != null && !requestedSiteId.equals(filer.getSite().getId())) {
			throw new ApiException(HttpStatus.FORBIDDEN.value(), "Cannot create a report for another site");
		}
		return filer.getSite();
	}

	private Long resolveSiteForList(AppUserDetails actor, Long siteId) {
		if (actor.getRole() == UserRole.super_admin) {
			if (siteId == null) {
				throw new ApiException(HttpStatus.BAD_REQUEST.value(), "siteId is required");
			}
			return siteId;
		}
		if (actor.getSiteId() == null) {
			throw new ApiException(HttpStatus.FORBIDDEN.value(), "Account is not scoped to a site");
		}
		if (siteId != null && !siteId.equals(actor.getSiteId())) {
			throw new ApiException(HttpStatus.FORBIDDEN.value(), "Cannot list reports for another site");
		}
		return actor.getSiteId();
	}

	private void assertCanViewSite(AppUserDetails actor, Long siteId) {
		if (actor.getRole() == UserRole.super_admin) {
			return;
		}
		if (actor.getSiteId() != null && actor.getSiteId().equals(siteId)) {
			return;
		}
		throw new ApiException(HttpStatus.FORBIDDEN.value(), "Not allowed to view this site's reports");
	}

	private boolean canSeeSensitive(AppUserDetails actor, Report report) {
		return switch (actor.getRole()) {
			case staff, admin, super_admin -> true;
			case technician -> report.getAssignedTechnician() != null
					&& report.getAssignedTechnician().getId().equals(actor.getId());
			case reporter -> reportReporterRepository.existsByReportIdAndUserId(report.getId(), actor.getId());
		};
	}

	private User loadUser(Long id) {
		return userRepository.findWithSiteById(id)
				.orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED.value(), "User not found"));
	}

	private String blankToNull(String value) {
		if (value == null || value.isBlank()) {
			return null;
		}
		return value.trim();
	}
}
