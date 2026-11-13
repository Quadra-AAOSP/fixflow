package com.example.fixflow.service;

import java.io.InputStream;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.example.fixflow.domain.Report;
import com.example.fixflow.domain.ReportNotification;
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
import com.example.fixflow.dto.UpdateReportRequest;
import com.example.fixflow.repository.ReportNotificationRepository;
import com.example.fixflow.repository.ReportPhotoRepository;
import com.example.fixflow.repository.ReportReporterRepository;
import com.example.fixflow.repository.ReportRepository;
import com.example.fixflow.repository.ReportVisionJobRepository;
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
	private final ReportNotificationRepository notifications;
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
	private final ReportVisionService reportVisionService;
	private final ReportVisionJobRepository reportVisionJobRepository;
	private final boolean requireSiteSetup;
	@org.springframework.beans.factory.annotation.Autowired
	private SiteVettingService vetting;
	@org.springframework.beans.factory.annotation.Value("${fixflow.urgency.medium-reporters:3}")
	private int mediumReporters;
	@org.springframework.beans.factory.annotation.Value("${fixflow.urgency.high-reporters:5}")
	private int highReporters;

	public ReportService(
			ReportRepository reportRepository,
			ReportReporterRepository reportReporterRepository,
			ReportNotificationRepository notifications,
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
			ReportVisionService reportVisionService,
			ReportVisionJobRepository reportVisionJobRepository,
			@org.springframework.beans.factory.annotation.Value("${fixflow.reporting.require-site-setup:true}") boolean requireSiteSetup
	) {
		this.reportRepository = reportRepository;
		this.reportReporterRepository = reportReporterRepository;
		this.notifications = notifications;
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
		this.reportVisionService = reportVisionService;
		this.reportVisionJobRepository = reportVisionJobRepository;
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
		report.setCalculatedUrgency(request.reporterUrgency());
		report.setReporterReason(blankToNull(request.reporterReason()));
		report.setVisibility(request.visibility() != null
				? request.visibility() : ReportVisibility.PUBLIC);
		report.setStatus(ReportStatus.open);
		report = reportRepository.save(report);

		ReportReporter attachment = new ReportReporter();
		attachment.setReportId(report.getId());
		attachment.setUserId(filer.getId());
		reportReporterRepository.saveAndFlush(attachment);
		recalculateUrgency(report);

		appendStatusHistory(report, null, ReportStatus.open, filer, "Report created");
		report = reportRepository.saveAndFlush(report);

		storePhotos(report, photos, 0);
		enqueueVisionForFirstPhoto(report.getId(), photos, actor);

		return response(reportRepository.findDetailedById(report.getId()).orElse(report), actor);
	}

	@Transactional(readOnly = true)
	public ReportPageResponse list(Long siteId, String category, boolean mine, int page, int size, AppUserDetails actor) {
		// "Mine" spans every site the actor has filed at, including sites other
		// than their account site. Used by the mobile Track reports view.
		if (mine) {
			List<ReportResponse> mineContent = reportRepository.findDetailedByCreatorId(actor.getId()).stream()
					.filter(report -> report.getVisibility() != ReportVisibility.PRIVATE
							|| canSeeSensitive(actor, report))
					.map(report -> response(report, actor))
					.toList();
			return new ReportPageResponse(mineContent, 0, mineContent.size(), mineContent.size(), 1);
		}
		Long scopedSiteId = resolveSiteForList(actor, siteId);
		int safePage = Math.max(page, 0);
		int safeSize = Math.min(Math.max(size, 1), 100);
		String categoryFilter = blankToNull(category);
		PageRequest pageRequest = PageRequest.of(safePage, safeSize);
		Page<Report> result = scopedSiteId == null
				? reportRepository.findOpenAllSites(categoryFilter, ReportStatus.confirmed, pageRequest)
				: reportRepository.findOpenBySite(scopedSiteId, categoryFilter, ReportStatus.confirmed, pageRequest);
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

	public record SearchFilters(String status, String category, String urgency, String from, String to, String text, Boolean canJoin, String visibility, Boolean unattended) {}
	public record SearchPage(List<ReportResponse> content, int page, boolean hasMore) {}

	@Transactional(readOnly = true)
	public SearchPage search(Long siteId, SearchFilters filters, int page, int size, AppUserDetails actor) {
		Long scopedSiteId = resolveSiteForList(actor, siteId);
		if (filters == null) throw new ApiException(400, "Filters are required");
		int safePage = Math.max(0, page), safeSize = Math.min(Math.max(size, 1), 100);
		com.example.fixflow.domain.Urgency urgency;
		ReportStatus status;
		ReportVisibility visibility;
		java.time.LocalDate from, to;
        if ((filters.from() != null && !filters.from().matches("[0-9]{4}-[0-9]{2}-[0-9]{2}"))
                || (filters.to() != null && !filters.to().matches("[0-9]{4}-[0-9]{2}-[0-9]{2}")))
            throw new ApiException(400, "Dates must use YYYY-MM-DD");
		try {
			status = filters.status() == null ? null : ReportStatus.valueOf(filters.status());
			visibility = filters.visibility() == null ? null : ReportVisibility.fromJson(filters.visibility());
			urgency = filters.urgency() == null ? null : com.example.fixflow.domain.Urgency.valueOf(filters.urgency());
			from = filters.from() == null ? null : java.time.LocalDate.parse(filters.from());
			to = filters.to() == null ? null : java.time.LocalDate.parse(filters.to());
		} catch (RuntimeException ex) { throw new ApiException(400, "Invalid search filters"); }
		if ((from != null && to != null && from.isAfter(to)) || (filters.category() != null && filters.category().length() > 128)
				|| (filters.text() != null && filters.text().length() > 500)) throw new ApiException(400, "Invalid search filters");
		// A site-scoped search is restricted to that site's category taxonomy.
		// The cross-site oversight search (super_admin, no siteId) cannot use a
		// single taxonomy, so it accepts any category name as-is.
		List<String> allowedCategories = null;
		String category = null;
		if (scopedSiteId != null) {
			var siteType = siteRepository.findById(scopedSiteId)
					.orElseThrow(() -> new ApiException(404, "Site not found")).getType();
			allowedCategories = categoryTaxonomyService.allowedCategories(siteType);
			category = filters.category() == null ? null
					: categoryTaxonomyService.requireAllowedCategory(siteType, filters.category());
		} else if (filters.category() != null && !filters.category().isBlank()) {
			category = filters.category().trim().toLowerCase(java.util.Locale.ROOT);
		}
		List<String> taxonomy = allowedCategories;
		String categoryFilterValue = category;
		Page<Report> result = reportRepository.findAll((root, query, cb) -> {
			var predicates = new ArrayList<jakarta.persistence.criteria.Predicate>();
			if (scopedSiteId != null) {
				predicates.add(cb.equal(root.get("site").get("id"), scopedSiteId));
			}
			if (taxonomy != null) {
				predicates.add(taxonomy.isEmpty() ? cb.disjunction() : root.get("category").in(taxonomy));
			}
			predicates.add(cb.isNull(root.get("archivedAt")));
			var membership = query.subquery(Long.class);
			var rr = membership.from(ReportReporter.class);
			membership.select(rr.get("reportId")).where(cb.equal(rr.get("reportId"), root.get("id")), cb.equal(rr.get("userId"), actor.getId()));
			var participant = cb.exists(membership);
			var sensitive = switch (actor.getRole()) {
				case staff, admin, super_admin -> cb.conjunction();
				case reporter -> participant;
				case technician -> cb.equal(root.join("assignedTechnician", jakarta.persistence.criteria.JoinType.LEFT).get("id"), actor.getId());
				default -> cb.disjunction();
			};
			predicates.add(cb.or(cb.equal(root.get("visibility"), ReportVisibility.PUBLIC), sensitive));
			if (status != null) predicates.add(cb.equal(root.get("status"), status));
			// "Unattended" = nobody has picked it up yet. Resolved work and
			// already-assigned work are excluded so the oversight queue stays
			// about reports that still need a first response.
			if (Boolean.TRUE.equals(filters.unattended())) {
				predicates.add(cb.isNull(root.get("assignedTechnician")));
				predicates.add(root.get("status").in(
						ReportStatus.open, ReportStatus.routed, ReportStatus.escalated, ReportStatus.reopened));
			}
			if (visibility != null) predicates.add(cb.equal(root.get("visibility"), visibility));
			if (categoryFilterValue != null) predicates.add(cb.equal(root.get("category"), categoryFilterValue));
			if (urgency != null) predicates.add(cb.equal(cb.coalesce(root.get("finalUrgency"), cb.coalesce(root.get("calculatedUrgency"), root.get("reporterUrgency"))), urgency));
			if (from != null) predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), from.atStartOfDay(java.time.ZoneOffset.UTC).toInstant()));
			if (to != null) predicates.add(cb.lessThan(root.get("createdAt"), to.plusDays(1).atStartOfDay(java.time.ZoneOffset.UTC).toInstant()));
			if (Boolean.TRUE.equals(filters.canJoin())) {
				predicates.add(actor.getRole() == UserRole.reporter ? cb.not(participant) : cb.disjunction());
				predicates.add(cb.notEqual(root.get("status"), ReportStatus.confirmed));
			}
			if (filters.text() != null && !filters.text().isBlank()) {
				String pattern = "%" + filters.text().toLowerCase(java.util.Locale.ROOT).replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%";
				predicates.add(cb.or(cb.like(cb.lower(root.get("description")), pattern, '!'), cb.like(cb.lower(root.get("category")), pattern, '!'),
						cb.like(cb.lower(root.get("specialty")), pattern, '!'), cb.and(sensitive, cb.like(cb.lower(root.get("address")), pattern, '!'))));
			}
			return cb.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
		}, PageRequest.of(safePage, safeSize, org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Order.desc("createdAt"), org.springframework.data.domain.Sort.Order.desc("id"))));
		return new SearchPage(result.getContent().stream().map(report -> response(report, actor)).toList(), safePage, result.hasNext());
	}

	@Transactional(readOnly = true)
	public boolean canRead(Long id, AppUserDetails actor) {
		try {
			get(id, actor);
			return true;
		} catch (ApiException ex) {
			if (ex.getStatus() == 403 || ex.getStatus() == 404) {
				return false;
			}
			throw ex;
		}
	}

	@Transactional(readOnly = true)
	public ReportResponse get(Long id, AppUserDetails actor) {
		Report report = reportRepository.findDetailedById(id)
				.orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND.value(), "Report not found"));
		assertCanReadReport(actor, report);
		return response(report, actor);
	}

	@Transactional
	public ReportResponse update(Long id, UpdateReportRequest request, AppUserDetails actor) {
		Report report = lockForChange(id, actor, false);
		String description = request.description().trim();
		String address = blankToNull(request.address());
		String reason = blankToNull(request.reporterReason());
		String category = request.category() == null ? null
				: categoryTaxonomyService.requireAllowedCategory(report.getSite().getType(), request.category());
		String specialty = request.specialty() == null ? null : blankToNull(request.specialty());
		boolean changed = !Objects.equals(report.getDescription(), description)
				|| !Objects.equals(report.getAddress(), address)
				|| report.getReporterUrgency() != request.reporterUrgency()
				|| !Objects.equals(report.getReporterReason(), reason)
				|| category != null && !Objects.equals(report.getCategory(), category)
				|| specialty != null && !Objects.equals(report.getSpecialty(), specialty)
				|| request.visibility() != null && report.getVisibility() != request.visibility();
		if (changed) {
			report.setDescription(description);
			report.setAddress(address);
			report.setReporterUrgency(request.reporterUrgency());
			recalculateUrgency(report);
			report.setReporterReason(reason);
			if (category != null) {
				report.setCategory(category);
			}
			if (specialty != null) {
				report.setSpecialty(specialty);
			}
			if (request.visibility() != null) {
				report.setVisibility(request.visibility());
			}
			reportRepository.flush();
			recordChange(report, actor, ReportNotification.Type.report_edited);
		}
		return response(report, actor);
	}

	@Transactional
	public void archive(Long id, AppUserDetails actor) {
		Report report = lockForChange(id, actor, true);
		recordChange(report, actor, ReportNotification.Type.report_deleted);
		report.setArchivedAt(Instant.now());
	}

	private Report lockForChange(Long id, AppUserDetails actor, boolean archive) {
		Report report = reportRepository.findForVisionUpdate(id)
				.orElseThrow(() -> new ApiException(404, "Report not found"));
		assertCanReadReport(actor, report);
		if (!canManageReport(actor, report)) {
			throw new ApiException(403, "Only the report creator or an authorized admin may change this report");
		}
		if (!isEditable(report) || archive && report.getStatus() == ReportStatus.in_progress) {
			throw new ApiException(409, "The report cannot be changed this way in its current state");
		}
		return report;
	}

	private boolean canManageReport(AppUserDetails actor, Report report) {
		if (actor.getRole() == UserRole.super_admin) {
			return true;
		}
		return report.getSite().getId().equals(actor.getSiteId())
				&& (actor.getRole() == UserRole.admin
				|| (actor.getRole() == UserRole.reporter || actor.getRole() == UserRole.staff)
				&& report.getCreatedBy().getId().equals(actor.getId()));
	}

	private boolean isEditable(Report report) {
		return report.isEditable() && report.getStatus() != ReportStatus.confirmed
				&& report.getStatus() != ReportStatus.resolved_pending_confirmation;
	}

	private void recordChange(Report report, AppUserDetails actor, ReportNotification.Type type) {
		Long siteId = report.getSite().getId();
		var recipients = new HashSet<>(userRepository.findIdsBySiteAndRole(siteId, UserRole.admin));
		recipients.add(report.getCreatedBy().getId());
		reportReporterRepository.findByReportIdOrderByJoinedAtAsc(report.getId())
				.forEach(participant -> recipients.add(participant.getUserId()));
		if (report.getAssignedTechnician() != null) {
			recipients.add(report.getAssignedTechnician().getId());
		}
		recipients.remove(actor.getId());
		Instant now = Instant.now();
		notifications.saveAll(recipients.stream()
				.map(id -> new ReportNotification(id, report.getId(), type, now)).toList());
		appendStatusHistory(report, report.getStatus(), report.getStatus(), loadUser(actor.getId()),
				type == ReportNotification.Type.report_edited ? "Report edited" : "Report archived");
	}

	public record NotifySiteAdminsResult(int recipients, String siteName) {}

	/**
	 * Super-admin oversight action: nudge every administrator of the report's
	 * site about a report that nobody has picked up yet.
	 *
	 * <p>The inbox row carries the report id, so the admin can open the report
	 * straight from the notice. Refusing already-attended reports keeps the
	 * notice meaningful (and stops duplicate nudges from piling up on work that
	 * is already moving).</p>
	 */
	@Transactional
	public NotifySiteAdminsResult notifySiteAdmin(Long id, AppUserDetails actor) {
		if (actor.getRole() != UserRole.super_admin) {
			throw new ApiException(HttpStatus.FORBIDDEN.value(),
					"Only super administrators can notify site administrators");
		}
		Report report = reportRepository.findDetailedById(id)
				.orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND.value(), "Report not found"));
		boolean stillOpen = report.getStatus() == ReportStatus.open
				|| report.getStatus() == ReportStatus.routed
				|| report.getStatus() == ReportStatus.escalated
				|| report.getStatus() == ReportStatus.reopened;
		if (!stillOpen || report.getAssignedTechnician() != null) {
			throw new ApiException(HttpStatus.CONFLICT.value(),
					"Only reports that nobody has picked up can be escalated to the site administrator");
		}
		Long siteId = report.getSite().getId();
		List<Long> recipients = userRepository.findIdsBySiteAndRole(siteId, UserRole.admin);
		if (recipients.isEmpty()) {
			throw new ApiException(HttpStatus.CONFLICT.value(),
					"This site has no site administrator to notify");
		}
		Instant now = Instant.now();
		notifications.saveAll(recipients.stream()
				.map(recipientId -> new ReportNotification(recipientId, report.getId(),
						ReportNotification.Type.report_unattended, now))
				.toList());
		appendStatusHistory(report, report.getStatus(), report.getStatus(), loadUser(actor.getId()),
				"Site administrator notified about unattended report");
		return new NotifySiteAdminsResult(recipients.size(), report.getSite().getName());
	}

	@Transactional
	public ReportResponse join(Long id, AppUserDetails actor) {
		if (actor.getRole() != UserRole.reporter) {
			throw new ApiException(403, "Only reporters can join reports");
		}
		Report report = reportRepository.findForVisionUpdate(id)
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
		reportReporterRepository.flush();
		recalculateUrgency(report);
		return response(report, actor);
	}

	@Transactional
	public ReportResponse leave(Long id, AppUserDetails actor) {
		if (actor.getRole() != UserRole.reporter) throw new ApiException(403, "Only reporters can leave reports");
		Report report = reportRepository.findForVisionUpdate(id).orElseThrow(() -> new ApiException(404, "Report not found"));
		assertCanViewSite(actor, report.getSite().getId());
		assertCanSeeVisibility(actor, report);
		if (report.getCreatedBy().getId().equals(actor.getId())) throw new ApiException(409, "The creator cannot leave their report");
		reportReporterRepository.deleteByReportIdAndUserId(id, actor.getId());
		reportReporterRepository.flush();
		recalculateUrgency(report);
		return response(report, actor);
	}

	@Transactional
	public long backfillCalculatedUrgency(long afterId) {
		var batch = reportRepository.findByCalculatedUrgencyIsNullAndIdGreaterThanOrderByIdAsc(afterId, PageRequest.of(0, 100));
		for (Report report : batch) {
			Report locked = reportRepository.findForVisionUpdate(report.getId()).orElseThrow();
			if (locked.getCalculatedUrgency() == null) recalculateUrgency(locked);
		}
		return batch.isEmpty() ? -1 : batch.get(batch.size() - 1).getId();
	}

	private void recalculateUrgency(Report report) {
		int count = Math.toIntExact(reportReporterRepository.countByReportId(report.getId()));
		report.setParticipationCount(count);
		var base = report.getReporterUrgency();
		report.setCalculatedUrgency(calculateUrgency(base, count, mediumReporters, highReporters));
	}

	static com.example.fixflow.domain.Urgency calculateUrgency(com.example.fixflow.domain.Urgency base, int count, int medium, int high) {
		var boost = count >= high ? com.example.fixflow.domain.Urgency.high : count >= medium ? com.example.fixflow.domain.Urgency.medium : com.example.fixflow.domain.Urgency.low;
		return base.ordinal() >= boost.ordinal() ? base : boost;
	}

	@Transactional(readOnly = true)
	public List<ReportReporterResponse> listReporters(Long id, AppUserDetails actor) {
		Report report = reportRepository.findDetailedById(id)
				.orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND.value(), "Report not found"));
		assertCanReadReport(actor, report);
		if (!canSeeSensitive(actor, report)) {
			throw new ApiException(HttpStatus.FORBIDDEN.value(), "Not allowed to list reporters on this report");
		}
		return reportReporterRepository.findByReportIdOrderByJoinedAtAsc(id).stream()
				.map(row -> {
					User person = userRepository.findById(row.getUserId()).orElse(null);
					String name = person == null ? null : (person.getFirstName() + " " + person.getLastName()).trim();
					return new ReportReporterResponse(row.getReportId(), row.getUserId(), row.getJoinedAt(), name);
				})
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
        vetting.requireEligible(technician.getId(), report.getSite().getId());
        events.publishEvent(new MarketplaceAssignmentReplaced(report.getId(), actor.getId()));
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
		enqueueVisionForFirstPhoto(reportId, photos, actor);
		return stored.stream()
				.map(photo -> ReportPhotoResponse.from(photo, reportId,
						ReportPhotoService.contentPath(reportId, photo.getId())))
				.toList();
	}

	@Transactional(readOnly = true)
	public String photoDownloadUrl(Long reportId, Long photoId, AppUserDetails actor) {
		Report report = reportRepository.findDetailedById(reportId)
				.orElseThrow(() -> new ApiException(404, "Report not found"));
		assertCanReadReport(actor, report);
		ReportPhoto photo = reportPhotoRepository.findByIdAndReport_Id(photoId, reportId)
				.orElseThrow(() -> new ApiException(404, "Photo not found"));
		return ReportPhotoService.contentPath(reportId, photoId);
	}

	@Transactional(readOnly = true)
	public InputStream openPhotoStream(Long reportId, Long photoId, AppUserDetails actor) {
		Report report = reportRepository.findDetailedById(reportId)
				.orElseThrow(() -> new ApiException(404, "Report not found"));
		assertCanReadReport(actor, report);
		ReportPhoto photo = reportPhotoRepository.findByIdAndReport_Id(photoId, reportId)
				.orElseThrow(() -> new ApiException(404, "Photo not found"));
		return objectStorageService.getObject(photo.getObjectKey());
	}

	@Transactional(readOnly = true)
	public ReportPhoto requirePhoto(Long reportId, Long photoId, AppUserDetails actor) {
		Report report = reportRepository.findDetailedById(reportId)
				.orElseThrow(() -> new ApiException(404, "Report not found"));
		assertCanReadReport(actor, report);
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
	public ReportResponse confirm(Long id, String signedName, AppUserDetails actor) {
		Report report = reportRepository.findForVisionUpdate(id)
				.orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND.value(), "Report not found"));
		assertCanReadReport(actor, report);
		assertCanConfirmOrReopen(report, actor);
        if (!report.getCreatedBy().getId().equals(actor.getId()) || actor.getRole() == UserRole.technician) throw new ApiException(403, "Only the report creator may confirm completion");
		if (report.getAssignedTechnician() != null && report.getAssignedTechnician().getId().equals(actor.getId())) throw new ApiException(403, "Technician cannot confirm own work");
        if (signedName == null || signedName.isBlank() || signedName.trim().length() > 255) throw new ApiException(400, "A signed name is required");
        if (report.getStatus() == ReportStatus.confirmed && report.getConfirmedBy() != null && report.getConfirmedBy().getId().equals(actor.getId())) return response(report, actor);
		if (report.getStatus() != ReportStatus.resolved_pending_confirmation) {
			throw new ApiException(409, "Cannot confirm a report that is not awaiting confirmation");
		}
		User user = loadUser(actor.getId());
		ReportStatus from = report.getStatus();
		report.setStatus(ReportStatus.confirmed);
		report.setConfirmedBy(user);
        report.setConfirmationSignedName(signedName.trim());
		report.setConfirmedAt(Instant.now());
		report = reportRepository.save(report);
		appendStatusHistory(report, from, ReportStatus.confirmed, user, "Report confirmed");
		publishStatusTransition(report, from, com.example.fixflow.realtime.ReportDomainEvent.CONFIRMATION);
		return response(report, actor);
	}

	@Transactional
	public ReportResponse reopen(Long id, ReopenReportRequest request, AppUserDetails actor) {
		Report report = reportRepository.findForVisionUpdate(id)
				.orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND.value(), "Report not found"));
		assertCanReadReport(actor, report);
		assertCanConfirmOrReopen(report, actor);
		if (report.getStatus() != ReportStatus.confirmed
				&& report.getStatus() != ReportStatus.resolved_pending_confirmation) {
			throw new ApiException(409, "Report cannot be reopened from its current status");
		}
		User user = loadUser(actor.getId());
		ReportStatus from = report.getStatus();
		report.setStatus(ReportStatus.reopened);
        report.setConfirmedBy(null);
        report.setConfirmedAt(null);
        report.setConfirmationSignedName(null);
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

	private void enqueueVisionForFirstPhoto(Long reportId, List<MultipartFile> photos, AppUserDetails actor) {
		if (photos == null || photos.isEmpty()) {
			return;
		}
		photos.stream()
				.filter(file -> file != null && !file.isEmpty())
				.findFirst()
				.ifPresent(file -> reportVisionService.enqueueAttachedPhoto(reportId, file, actor));
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
		assertCanReadReport(actor, report);
		boolean allowed = switch (actor.getRole()) {
			case reporter -> reportReporterRepository.existsByReportIdAndUserId(report.getId(), actor.getId())
					|| (report.getCreatedBy() != null && report.getCreatedBy().getId().equals(actor.getId()));
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
		if (filer.getRole() == UserRole.reporter) {
			// Reporters file wherever the issue actually is. The account site
			// chosen at sign-up is only the default, not a filing restriction.
			if (requestedSiteId != null) {
				return siteRepository.findById(requestedSiteId)
						.orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST.value(), "Site not found"));
			}
			if (filer.getSite() == null) {
				throw new ApiException(HttpStatus.BAD_REQUEST.value(), "Account is not scoped to a site");
			}
			return filer.getSite();
		}
		if (filer.getSite() == null && requestedSiteId == null) {
			throw new ApiException(HttpStatus.BAD_REQUEST.value(), "Account is not scoped to a site");
		}
		// Staff and admins may file at any existing site too — they often
		// notice issues outside their own site and the account site is only
		// the default.
		if (requestedSiteId != null) {
			return siteRepository.findById(requestedSiteId)
					.orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST.value(), "Site not found"));
		}
		return filer.getSite();
	}

	/**
	 * Site scope for read/list operations. A {@code null} return means "no site
	 * restriction" and is only ever produced for a super administrator who did
	 * not pick a site — that is the cross-site oversight view.
	 */
	private Long resolveSiteForList(AppUserDetails actor, Long siteId) {
		if (actor.getRole() == UserRole.super_admin) {
			// null = every site; a concrete id = that site only.
			return siteId;
		}
		// Technicians are not scoped to a single site — their access comes
		// from contracts. Let them read the queue for any site they are
		// contracted to (the mobile Assignments tab fans out over these).
		if (actor.getRole() == UserRole.technician) {
			if (siteId == null) {
				throw new ApiException(HttpStatus.BAD_REQUEST.value(), "siteId is required");
			}
			if (!contracts.existsByTechnician_IdAndSite_Id(actor.getId(), siteId)) {
				throw new ApiException(HttpStatus.FORBIDDEN.value(), "Technician is not contracted to this site");
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
		if (actor.getRole() == UserRole.technician) {
			if (contracts.existsByTechnician_IdAndSite_Id(actor.getId(), siteId)) {
				return;
			}
		}
		if (actor.getSiteId() != null && actor.getSiteId().equals(siteId)) {
			return;
		}
		throw new ApiException(HttpStatus.FORBIDDEN.value(), "Not allowed to view this site's reports");
	}

	private void assertCanReadReport(AppUserDetails actor, Report report) {
		if (actor.getRole() == UserRole.technician) {
			if (!canSeeSensitive(actor, report)) {
				throw new ApiException(403, "Only the currently assigned technician may view this report");
			}
			return;
		}
		if (report.getCreatedBy() != null && report.getCreatedBy().getId().equals(actor.getId())) {
			// Whoever filed the report keeps access to it even when they filed
			// it at a site other than their account site.
			assertCanSeeVisibility(actor, report);
			return;
		}
		assertCanViewSite(actor, report.getSite().getId());
		assertCanSeeVisibility(actor, report);
	}

	private boolean canSeeSensitive(AppUserDetails actor, Report report) {
		return switch (actor.getRole()) {
			case staff, admin, super_admin -> true;
			case technician -> report.getAssignedTechnician() != null
					&& report.getAssignedTechnician().getId().equals(actor.getId());
			case reporter -> (report.getCreatedBy() != null
					&& report.getCreatedBy().getId().equals(actor.getId()))
					|| reportReporterRepository.existsByReportIdAndUserId(report.getId(), actor.getId());
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
		boolean canEdit = canManageReport(actor, report) && isEditable(report);
		List<ReportPhotoResponse> photos = canSee
				? actor.getRole() == UserRole.technician ? reportPhotoService.listWithSessionUrls(report.getId())
                        : reportPhotoService.listWithPresignedUrls(report.getId())
				: List.of();
		ReportResponse.VisionJob visionJob = canSee
				? reportVisionJobRepository.findFirstByReportIdOrderByCreatedAtDesc(report.getId())
						.map(job -> new ReportResponse.VisionJob(
								job.getId(), job.getReportId(), job.getStatus(), job.getModel()))
						.orElse(null)
				: null;
		return ReportResponse.from(report, com.example.fixflow.dto.ReportPolicy.from(
				report, canSee, participant, canAssign,
				actor.getRole() == UserRole.reporter && !participant, ownQueue,
				canEdit, canEdit && report.getStatus() != ReportStatus.in_progress), photos,
                actor.getRole() == UserRole.admin || actor.getRole() == UserRole.super_admin || actor.getRole() == UserRole.staff,
				visionJob);
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
