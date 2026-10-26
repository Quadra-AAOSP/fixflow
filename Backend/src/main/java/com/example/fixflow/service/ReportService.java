package com.example.fixflow.service;

import java.io.InputStream;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.example.fixflow.domain.Report;
import com.example.fixflow.domain.ReportPhoto;
import com.example.fixflow.domain.ReportReporter;
import com.example.fixflow.domain.ReportStatus;
import com.example.fixflow.domain.ReportVisibility;
import com.example.fixflow.domain.Site;
import com.example.fixflow.domain.StatusHistory;
import com.example.fixflow.domain.User;
import com.example.fixflow.domain.UserRole;
import com.example.fixflow.dto.AssignTechnicianRequest;
import com.example.fixflow.dto.CreateReportRequest;
import com.example.fixflow.dto.ReopenReportRequest;
import com.example.fixflow.dto.ReportPageResponse;
import com.example.fixflow.dto.ReportPhotoResponse;
import com.example.fixflow.dto.ReportReporterResponse;
import com.example.fixflow.dto.ReportResponse;
import com.example.fixflow.repository.ReportPhotoRepository;
import com.example.fixflow.repository.ReportReporterRepository;
import com.example.fixflow.repository.ReportRepository;
import com.example.fixflow.repository.SiteRepository;
import com.example.fixflow.repository.StatusHistoryRepository;
import com.example.fixflow.repository.SubsiteRepository;
import com.example.fixflow.repository.UserRepository;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.web.ApiException;

@Service
public class ReportService {

	private final ReportRepository reportRepository;
	private final ReportReporterRepository reportReporterRepository;
	private final ReportPhotoRepository reportPhotoRepository;
	private final StatusHistoryRepository statusHistoryRepository;
	private final UserRepository userRepository;
	private final SiteRepository siteRepository;
	private final SubsiteRepository subsiteRepository;
	private final CategoryTaxonomyService categoryTaxonomyService;
	private final RoleIntegrityService roleIntegrityService;
    private final org.springframework.context.ApplicationEventPublisher events;
    private final com.example.fixflow.repository.TechnicianContractRepository contracts;
	private final ReportClassificationService classificationService;
	private final TechnicianTermsService terms;
	private final ObjectStorageService objectStorageService;
	private final ReportPhotoValidator photoValidator;
	private final ReportPhotoService reportPhotoService;
	private final boolean requireSiteSetup;

	public ReportService(
			ReportRepository reportRepository,
			ReportReporterRepository reportReporterRepository,
			ReportPhotoRepository reportPhotoRepository,
			StatusHistoryRepository statusHistoryRepository,
			UserRepository userRepository,
			SiteRepository siteRepository,
			SubsiteRepository subsiteRepository,
			CategoryTaxonomyService categoryTaxonomyService,
			RoleIntegrityService roleIntegrityService,
            org.springframework.context.ApplicationEventPublisher events,
            com.example.fixflow.repository.TechnicianContractRepository contracts,
			ReportClassificationService classificationService,
			TechnicianTermsService terms,
			ObjectStorageService objectStorageService,
			ReportPhotoValidator photoValidator,
			ReportPhotoService reportPhotoService,
			@org.springframework.beans.factory.annotation.Value("${fixflow.reporting.require-site-setup:true}") boolean requireSiteSetup
	) {
		this.reportRepository = reportRepository;
		this.reportReporterRepository = reportReporterRepository;
		this.reportPhotoRepository = reportPhotoRepository;
		this.statusHistoryRepository = statusHistoryRepository;
		this.userRepository = userRepository;
		this.siteRepository = siteRepository;
		this.subsiteRepository = subsiteRepository;
		this.categoryTaxonomyService = categoryTaxonomyService;
		this.roleIntegrityService = roleIntegrityService;
        this.events = events;
        this.contracts = contracts;
		this.classificationService = classificationService;
		this.terms = terms;
		this.objectStorageService = objectStorageService;
		this.photoValidator = photoValidator;
		this.reportPhotoService = reportPhotoService;
		this.requireSiteSetup = requireSiteSetup;
	}

	@Transactional
	public ReportResponse classify(Long id, AppUserDetails actor) {
		if (actor.getRole() != UserRole.admin && actor.getRole() != UserRole.super_admin) {
			throw new ApiException(403, "Only site admins or super admins can classify reports");
		}
		Report report = reportRepository.findForVisionUpdate(id)
				.orElseThrow(() -> new ApiException(404, "Report not found"));
		assertCanViewSite(actor, report.getSite().getId());
		classificationService.classify(report);
		return response(reportRepository.saveAndFlush(report), actor);
	}

	@Transactional
	public ReportResponse create(CreateReportRequest request, AppUserDetails actor) {
		return createInternal(request, actor, List.of());
	}

	@Transactional
	public ReportResponse createMultipart(CreateReportRequest request, List<MultipartFile> photos, AppUserDetails actor) {
		photoValidator.validateBatch(photos, 0);
		return createInternal(request, actor, photos == null ? List.of() : photos);
	}

	private ReportResponse createInternal(
			CreateReportRequest request,
			AppUserDetails actor,
			List<MultipartFile> photos
	) {
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
		if (request.subsiteId() != null) {
			com.example.fixflow.domain.Subsite subsite = subsiteRepository.findById(request.subsiteId())
					.orElseThrow(() -> new ApiException(400, "Subsite not found"));
			if (!subsite.getSite().getId().equals(site.getId())) {
				throw new ApiException(400, "Subsite must belong to the report's site");
			}
			report.setSubsite(subsite);
			if (subsite.getArchivedAt() != null) {
				throw new ApiException(400, "Archived subsites cannot be selected for new reports");
			}
		}
		if (requireSiteSetup && !subsiteRepository.existsBySite_IdAndArchivedAtIsNull(site.getId())) {
			throw new ApiException(409, "Site setup required: ask the site admin to add an active subsite before reporting");
		}
		report.setCreatedBy(filer);
		report.setDescription(request.description().trim());
		report.setAddress(blankToNull(request.address()));
		report.setCategory(category);
		report.setSpecialty(blankToNull(request.specialty()));
		report.setReporterUrgency(request.reporterUrgency());
		report.setReporterReason(blankToNull(request.reporterReason()));
		report.setVisibility(request.visibility() != null
				? request.visibility() : ReportVisibility.PUBLIC);
		report.setStatus(ReportStatus.open);
		report = reportRepository.save(report);

		ReportReporter attachment = new ReportReporter();
		attachment.setReportId(report.getId());
		attachment.setUserId(filer.getId());
		reportReporterRepository.save(attachment);

		appendStatusHistory(report, null, ReportStatus.open, filer, "Report created");
		report = reportRepository.saveAndFlush(report);

		storePhotos(report, photos, 0);

		return response(reportRepository.findDetailedById(report.getId()).orElse(report), actor);
	}

	@Transactional(readOnly = true)
	public ReportPageResponse list(Long siteId, String category, int page, int size, AppUserDetails actor) {
		Long scopedSiteId = resolveSiteForList(actor, siteId);
		int safePage = Math.max(page, 0);
		int safeSize = Math.min(Math.max(size, 1), 100);
		String categoryFilter = blankToNull(category);
		Page<Report> result = reportRepository.findOpenBySite(
				scopedSiteId,
				categoryFilter,
				ReportStatus.confirmed,
				PageRequest.of(safePage, safeSize)
		);
		List<Long> ids = result.getContent().stream().map(Report::getId).toList();
		Map<Long, Report> detailed = new HashMap<>();
		if (!ids.isEmpty()) {
			for (Report report : reportRepository.findDetailedByIdIn(ids)) {
				detailed.put(report.getId(), report);
			}
		}
		List<ReportResponse> content = result.getContent().stream()
				.map(report -> detailed.getOrDefault(report.getId(), report))
				.filter(report -> report.getVisibility() != ReportVisibility.PRIVATE
						|| canSeeSensitive(actor, report))
				.map(report -> response(report, actor))
				.toList();
		return new ReportPageResponse(content, safePage, safeSize, result.getTotalElements(), result.getTotalPages());
	}

	@Transactional(readOnly = true)
	public ReportResponse get(Long id, AppUserDetails actor) {
		Report report = reportRepository.findDetailedById(id)
				.orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND.value(), "Report not found"));
		if (actor.getRole() == UserRole.technician) {
            if (report.getAssignedTechnician() == null
                    || !report.getAssignedTechnician().getId().equals(actor.getId())) {
                throw new ApiException(403, "Only the currently assigned technician may view this report");
            }
        } else {
            assertCanViewSite(actor, report.getSite().getId());
			assertCanSeeVisibility(actor, report);

        }
		return response(report, actor);
	}

	@Transactional
	public ReportResponse join(Long id, AppUserDetails actor) {
		if (actor.getRole() != UserRole.reporter) {
			throw new ApiException(403, "Only reporters can join reports");
		}
		Report report = reportRepository.findDetailedById(id)
				.orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND.value(), "Report not found"));
		assertCanViewSite(actor, report.getSite().getId());
		assertCanSeeVisibility(actor, report);
		if (report.getStatus() == ReportStatus.confirmed) {
			throw new ApiException(409, "Cannot join a confirmed report");
		}
		if (!reportReporterRepository.existsByReportIdAndUserId(id, actor.getId())) {
			ReportReporter attachment = new ReportReporter();
			attachment.setReportId(id);
			attachment.setUserId(actor.getId());
			reportReporterRepository.save(attachment);
		}
		return response(report, actor);
	}

	@Transactional(readOnly = true)
	public List<ReportReporterResponse> listReporters(Long id, AppUserDetails actor) {
		Report report = reportRepository.findDetailedById(id)
				.orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND.value(), "Report not found"));
		assertCanViewSite(actor, report.getSite().getId());
		assertCanSeeVisibility(actor, report);
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
		Report report = reportRepository.findForVisionUpdate(id)
				.orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND.value(), "Report not found"));
		assertCanViewSite(actor, report.getSite().getId());
		User technician = userRepository.findById(request.technicianId())
				.orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST.value(), "Technician not found"));
		roleIntegrityService.requireTechnician(technician);
        if (!contracts.existsByTechnician_IdAndSite_Id(technician.getId(), report.getSite().getId())) {
            throw new ApiException(409, "Technician must have a contract with the report's site before assignment");
        }
        terms.requireAcceptance(technician.getId());
        ReportStatus previousStatus = report.getStatus();
        Long previousAssignee = report.getAssignedTechnician() == null ? null : report.getAssignedTechnician().getId();
		report.setAssignedTechnician(technician);
		report.setStatus(ReportStatus.assigned);
        reportRepository.save(report);
        appendStatusHistory(report, previousStatus, ReportStatus.assigned, loadUser(actor.getId()), "Technician assigned");
        if (!java.util.Objects.equals(previousAssignee, technician.getId())) {
            events.publishEvent(com.example.fixflow.realtime.ReportDomainEvent.of(
                    previousAssignee == null ? com.example.fixflow.realtime.ReportDomainEvent.ASSIGNMENT
                            : com.example.fixflow.realtime.ReportDomainEvent.REASSIGNMENT,
                    report.getSite().getId(), id, previousStatus, report.getStatus(), previousAssignee, technician.getId()));
        }
        if (previousStatus != report.getStatus()) {
            events.publishEvent(com.example.fixflow.realtime.ReportDomainEvent.of(
                    com.example.fixflow.realtime.ReportDomainEvent.STATUS_CHANGE, report.getSite().getId(), id,
                    previousStatus, report.getStatus(), previousAssignee, technician.getId()));
        }
        return response(report, actor);
	}

	@Transactional
	public List<ReportPhotoResponse> addPhotos(Long reportId, List<MultipartFile> photos, AppUserDetails actor) {
		Report report = reportRepository.findDetailedById(reportId)
				.orElseThrow(() -> new ApiException(404, "Report not found"));
		assertCanManagePhotos(actor, report);
		long existing = reportPhotoRepository.countByReport_Id(reportId);
		photoValidator.validateBatch(photos, (int) existing);
		List<ReportPhoto> stored = storePhotos(report, photos, (int) existing);
		return stored.stream()
				.map(photo -> ReportPhotoResponse.from(photo, reportId,
						objectStorageService.presignedGetUrl(photo.getObjectKey(), Duration.ofHours(1))))
				.toList();
	}

	@Transactional(readOnly = true)
	public String photoDownloadUrl(Long reportId, Long photoId, AppUserDetails actor) {
		Report report = reportRepository.findDetailedById(reportId)
				.orElseThrow(() -> new ApiException(404, "Report not found"));
		assertCanViewSite(actor, report.getSite().getId());
		assertCanSeeVisibility(actor, report);
		ReportPhoto photo = reportPhotoRepository.findByIdAndReport_Id(photoId, reportId)
				.orElseThrow(() -> new ApiException(404, "Photo not found"));
		return objectStorageService.presignedGetUrl(photo.getObjectKey(), Duration.ofMinutes(15));
	}

	@Transactional(readOnly = true)
	public InputStream openPhotoStream(Long reportId, Long photoId, AppUserDetails actor) {
		Report report = reportRepository.findDetailedById(reportId)
				.orElseThrow(() -> new ApiException(404, "Report not found"));
		assertCanViewSite(actor, report.getSite().getId());
		assertCanSeeVisibility(actor, report);
		ReportPhoto photo = reportPhotoRepository.findByIdAndReport_Id(photoId, reportId)
				.orElseThrow(() -> new ApiException(404, "Photo not found"));
		return objectStorageService.getObject(photo.getObjectKey());
	}

	@Transactional(readOnly = true)
	public ReportPhoto requirePhoto(Long reportId, Long photoId, AppUserDetails actor) {
		Report report = reportRepository.findDetailedById(reportId)
				.orElseThrow(() -> new ApiException(404, "Report not found"));
		assertCanViewSite(actor, report.getSite().getId());
		assertCanSeeVisibility(actor, report);
		return reportPhotoRepository.findByIdAndReport_Id(photoId, reportId)
				.orElseThrow(() -> new ApiException(404, "Photo not found"));
	}

	@Transactional
	public void deletePhoto(Long reportId, Long photoId, AppUserDetails actor) {
		Report report = reportRepository.findDetailedById(reportId)
				.orElseThrow(() -> new ApiException(404, "Report not found"));
		assertCanManagePhotos(actor, report);
		ReportPhoto photo = reportPhotoRepository.findByIdAndReport_Id(photoId, reportId)
				.orElseThrow(() -> new ApiException(404, "Photo not found"));
		String objectKey = photo.getObjectKey();
		reportPhotoRepository.delete(photo);
		objectStorageService.deleteObject(objectKey);
	}

	@Transactional
	public ReportResponse confirm(Long id, AppUserDetails actor) {
		Report report = reportRepository.findDetailedById(id)
				.orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND.value(), "Report not found"));
		assertCanViewSite(actor, report.getSite().getId());
		assertCanSeeVisibility(actor, report);
		assertCanConfirmOrReopen(report, actor);
		if (report.getStatus() != ReportStatus.resolved_pending_confirmation) {
			throw new ApiException(409, "Cannot confirm a report that is not awaiting confirmation");
		}
		User user = loadUser(actor.getId());
		ReportStatus from = report.getStatus();
		report.setStatus(ReportStatus.confirmed);
		report.setConfirmedBy(user);
		report.setConfirmedAt(Instant.now());
		report = reportRepository.save(report);
		appendStatusHistory(report, from, ReportStatus.confirmed, user, "Report confirmed");
		publishStatusTransition(report, from, com.example.fixflow.realtime.ReportDomainEvent.CONFIRMATION);
		return response(report, actor);
	}

	@Transactional
	public ReportResponse reopen(Long id, ReopenReportRequest request, AppUserDetails actor) {
		Report report = reportRepository.findDetailedById(id)
				.orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND.value(), "Report not found"));
		assertCanViewSite(actor, report.getSite().getId());
		assertCanSeeVisibility(actor, report);
		assertCanConfirmOrReopen(report, actor);
		if (report.getStatus() != ReportStatus.confirmed
				&& report.getStatus() != ReportStatus.resolved_pending_confirmation) {
			throw new ApiException(409, "Report cannot be reopened from its current status");
		}
		User user = loadUser(actor.getId());
		ReportStatus from = report.getStatus();
		report.setStatus(ReportStatus.reopened);
		report.setReopenCount(report.getReopenCount() + 1);
		report.setReopenReason(request.reason().trim());
		report = reportRepository.save(report);
		appendStatusHistory(report, from, ReportStatus.reopened, user, "Report reopened");
		publishStatusTransition(report, from, com.example.fixflow.realtime.ReportDomainEvent.STATUS_CHANGE);
		return response(report, actor);
	}

	private void publishStatusTransition(Report report, ReportStatus from, String eventType) {
		Long assignee = report.getAssignedTechnician() == null ? null : report.getAssignedTechnician().getId();
		events.publishEvent(com.example.fixflow.realtime.ReportDomainEvent.of(eventType,
				report.getSite().getId(), report.getId(), from, report.getStatus(), assignee, assignee));
	}

	private List<ReportPhoto> storePhotos(Report report, List<MultipartFile> photos, int startingSortOrder) {
		if (photos == null || photos.isEmpty()) {
			return List.of();
		}
		List<MultipartFile> present = photos.stream()
				.filter(file -> file != null && !file.isEmpty())
				.toList();
		if (present.isEmpty()) {
			return List.of();
		}

		List<String> uploadedKeys = new ArrayList<>();
		List<ReportPhoto> saved = new ArrayList<>();
		try {
			int sortOrder = startingSortOrder;
			for (MultipartFile file : present) {
				photoValidator.validateOne(file);
				String contentType = photoValidator.normalizeContentType(file.getContentType());
				String objectKey = "reports/" + report.getId() + "/" + UUID.randomUUID() + "."
						+ photoValidator.extensionFor(contentType);
				try (InputStream stream = file.getInputStream()) {
					objectStorageService.putObject(objectKey, stream, file.getSize(), contentType);
				}
				uploadedKeys.add(objectKey);

				ReportPhoto photo = new ReportPhoto();
				photo.setReport(report);
				photo.setObjectKey(objectKey);
				photo.setContentType(contentType);
				photo.setFileSizeBytes((int) file.getSize());
				photo.setSortOrder(sortOrder++);
				photo.setUrl("/api/reports/" + report.getId() + "/photos/" + objectKey);
				saved.add(reportPhotoRepository.save(photo));
			}
			return saved;
		} catch (RuntimeException | java.io.IOException ex) {
			for (String key : uploadedKeys) {
				objectStorageService.deleteObject(key);
			}
			if (ex instanceof ApiException apiException) {
				throw apiException;
			}
			throw new ApiException(502, "Failed to store report photos");
		}
	}

	private void appendStatusHistory(
			Report report,
			ReportStatus from,
			ReportStatus to,
			User changedBy,
			String note
	) {
		StatusHistory history = new StatusHistory();
		history.setReport(report);
		history.setFromStatus(from == null ? null : from.name());
		history.setToStatus(to.name());
		history.setChangedBy(changedBy);
		history.setNote(note);
		statusHistoryRepository.save(history);
	}

	private void assertCanManagePhotos(AppUserDetails actor, Report report) {
		assertCanViewSite(actor, report.getSite().getId());
		assertCanSeeVisibility(actor, report);
		boolean allowed = switch (actor.getRole()) {
			case reporter -> reportReporterRepository.existsByReportIdAndUserId(report.getId(), actor.getId());
			case staff, admin, super_admin -> true;
			default -> false;
		};
		if (!allowed) {
			throw new ApiException(403, "Not allowed to manage photos on this report");
		}
	}

	private void assertCanConfirmOrReopen(Report report, AppUserDetails actor) {
		switch (actor.getRole()) {
			case staff, admin, super_admin -> {
				return;
			}
			case reporter -> {
				boolean isCreator = report.getCreatedBy() != null
						&& report.getCreatedBy().getId().equals(actor.getId());
				boolean isParticipant = reportReporterRepository.existsByReportIdAndUserId(report.getId(), actor.getId());
				if (isCreator || isParticipant) {
					return;
				}
			}
			default -> {
			}
		}
		throw new ApiException(HttpStatus.FORBIDDEN.value(), "Not allowed to confirm or reopen this report");
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
			case shop_manager -> false;
		};
	}

	/**
	 * 404 (not 403) for private reports outside the sensitive audience, so
	 * existence itself is not leaked to same-site reporters.
	 */
	private void assertCanSeeVisibility(AppUserDetails actor, Report report) {
		if (report.getVisibility() == ReportVisibility.PRIVATE && !canSeeSensitive(actor, report)) {
			throw new ApiException(HttpStatus.NOT_FOUND.value(), "Report not found");
		}
	}

	private ReportResponse response(Report report, AppUserDetails actor) {
		boolean participant = reportReporterRepository.existsByReportIdAndUserId(report.getId(), actor.getId());
		boolean canAssign = com.example.fixflow.dto.UserCapabilities.forRole(actor.getRole()).assignTechnician();
		boolean ownQueue = actor.getRole() != UserRole.technician
				|| report.getAssignedTechnician() != null
				&& report.getAssignedTechnician().getId().equals(actor.getId());
		boolean canSee = canSeeSensitive(actor, report);
		List<ReportPhotoResponse> photos = canSee
				? reportPhotoService.listWithPresignedUrls(report.getId())
				: List.of();
		return ReportResponse.from(report, com.example.fixflow.dto.ReportPolicy.from(
				report, canSee, participant, canAssign,
				actor.getRole() == UserRole.reporter && !participant, ownQueue), photos,
                actor.getRole() == UserRole.admin || actor.getRole() == UserRole.super_admin || actor.getRole() == UserRole.staff);
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
