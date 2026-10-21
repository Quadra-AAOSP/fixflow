package com.example.fixflow.service;

import java.io.InputStream;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.example.fixflow.domain.Report;
import com.example.fixflow.domain.ReportPhoto;
import com.example.fixflow.domain.ReportVisibility;
import com.example.fixflow.domain.UserRole;
import com.example.fixflow.dto.ReportPhotoResponse;
import com.example.fixflow.repository.ReportPhotoRepository;
import com.example.fixflow.repository.ReportReporterRepository;
import com.example.fixflow.repository.ReportRepository;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.web.ApiException;

@Service
public class ReportPhotoService {

	private final ReportRepository reportRepository;
	private final ReportReporterRepository reportReporterRepository;
	private final ReportPhotoRepository reportPhotoRepository;
	private final ObjectStorageService objectStorageService;
	private final ReportPhotoValidator photoValidator;

	public ReportPhotoService(
			ReportRepository reportRepository,
			ReportReporterRepository reportReporterRepository,
			ReportPhotoRepository reportPhotoRepository,
			ObjectStorageService objectStorageService,
			ReportPhotoValidator photoValidator) {
		this.reportRepository = reportRepository;
		this.reportReporterRepository = reportReporterRepository;
		this.reportPhotoRepository = reportPhotoRepository;
		this.objectStorageService = objectStorageService;
		this.photoValidator = photoValidator;
	}

	@Transactional(readOnly = true)
	public List<ReportPhotoResponse> list(Long reportId, AppUserDetails actor) {
		loadAndAuthorize(reportId, actor);
		return listWithPresignedUrls(reportId);
	}

	@Transactional
	public ReportPhotoResponse upload(Long reportId, MultipartFile file, AppUserDetails actor) {
		Report report = loadAndAuthorize(reportId, actor);
		photoValidator.validateOne(file);

		long existingCount = reportPhotoRepository.countByReportId(reportId);
		if (existingCount >= 5) {
			throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY.value(), "Maximum 5 photos per report");
		}

		String contentType = photoValidator.normalizeContentType(file.getContentType());
		int sortOrder = (int) existingCount;
		String objectKey = "reports/" + reportId + "/" + UUID.randomUUID() + "."
				+ photoValidator.extensionFor(contentType);

		try (InputStream stream = file.getInputStream()) {
			objectStorageService.putObject(objectKey, stream, file.getSize(), contentType);
		} catch (ApiException ex) {
			throw ex;
		} catch (Exception e) {
			throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR.value(),
					"Failed to upload photo: " + e.getMessage());
		}

		ReportPhoto photo = new ReportPhoto();
		photo.setReport(report);
		photo.setObjectKey(objectKey);
		photo.setUrl(null);
		photo.setContentType(contentType);
		photo.setFileSizeBytes((int) file.getSize());
		photo.setSortOrder(sortOrder);
		photo = reportPhotoRepository.save(photo);

		return toResponse(photo, reportId);
	}

	@Transactional
	public void delete(Long reportId, Long photoId, AppUserDetails actor) {
		loadAndAuthorize(reportId, actor);

		ReportPhoto photo = reportPhotoRepository.findByIdAndReportId(photoId, reportId)
				.orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND.value(), "Photo not found"));

		objectStorageService.deleteObject(photo.getObjectKey());
		reportPhotoRepository.delete(photo);

		List<ReportPhoto> remaining = reportPhotoRepository
				.findByReportIdOrderBySortOrderAscCreatedAtAsc(reportId);
		int idx = 0;
		for (ReportPhoto p : remaining) {
			if (p.getSortOrder() != idx) {
				p.setSortOrder(idx);
				reportPhotoRepository.save(p);
			}
			idx++;
		}
	}

	@Transactional(readOnly = true)
	public Map<String, String> presignedUrl(Long reportId, Long photoId, AppUserDetails actor) {
		loadAndAuthorize(reportId, actor);
		ReportPhoto photo = reportPhotoRepository.findByIdAndReportId(photoId, reportId)
				.orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND.value(), "Photo not found"));
		return Map.of("url", objectStorageService.presignedGetUrl(photo.getObjectKey(), Duration.ofHours(1)));
	}

	@Transactional(readOnly = true)
	public List<ReportPhotoResponse> listWithPresignedUrls(Long reportId) {
		return reportPhotoRepository.findByReportIdOrderBySortOrderAscCreatedAtAsc(reportId).stream()
				.map(photo -> toResponse(photo, reportId))
				.toList();
	}

	private Report loadAndAuthorize(Long reportId, AppUserDetails actor) {
		Report report = reportRepository.findDetailedById(reportId)
				.orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND.value(), "Report not found"));

		if (actor.getRole() != UserRole.super_admin) {
			if (actor.getSiteId() == null || !actor.getSiteId().equals(report.getSite().getId())) {
				throw new ApiException(HttpStatus.FORBIDDEN.value(),
						"Not allowed to view this site's reports");
			}
		}

		switch (actor.getRole()) {
			case staff, admin, super_admin -> {
			}
			case reporter -> {
				boolean creator = report.getCreatedBy() != null
						&& report.getCreatedBy().getId().equals(actor.getId());
				boolean participant = reportReporterRepository.existsByReportIdAndUserId(
						reportId, actor.getId());
				if (!creator && !participant) {
					throw new ApiException(HttpStatus.FORBIDDEN.value(),
							"Not allowed to act on this report's photos");
				}
			}
			case technician, shop_manager -> {
				throw new ApiException(HttpStatus.FORBIDDEN.value(),
						"This role cannot act on report photos");
			}
		}

		if (report.getVisibility() == ReportVisibility.PRIVATE) {
			boolean canSee = switch (actor.getRole()) {
				case staff, admin, super_admin -> true;
				case reporter -> report.getCreatedBy() != null
						&& report.getCreatedBy().getId().equals(actor.getId())
						|| reportReporterRepository.existsByReportIdAndUserId(reportId, actor.getId());
				case technician -> report.getAssignedTechnician() != null
						&& report.getAssignedTechnician().getId().equals(actor.getId());
				case shop_manager -> false;
			};
			if (!canSee) {
				throw new ApiException(HttpStatus.NOT_FOUND.value(), "Report not found");
			}
		}

		return report;
	}

	private ReportPhotoResponse toResponse(ReportPhoto photo, Long reportId) {
		String presigned = null;
		try {
			presigned = objectStorageService.presignedGetUrl(photo.getObjectKey(), Duration.ofHours(1));
		} catch (Exception ignored) {
			// Leave url null if storage cannot mint a temporary URL.
		}
		return ReportPhotoResponse.from(photo, reportId, presigned);
	}
}
