package com.example.fixflow.service;

import java.io.InputStream;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.example.fixflow.config.MinioConfig;
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

import io.minio.GetPresignedObjectUrlArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.RemoveObjectArgs;
import io.minio.http.Method;

@Service
public class ReportPhotoService {

	private static final Logger log = LoggerFactory.getLogger(ReportPhotoService.class);
	private static final long MAX_FILE_SIZE = 5_242_880L; // 5 MB
	private static final int MAX_PHOTOS_PER_REPORT = 5;
	private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
			"image/jpeg", "image/png", "image/webp", "image/gif", "image/heic");

	private final ReportRepository reportRepository;
	private final ReportReporterRepository reportReporterRepository;
	private final ReportPhotoRepository reportPhotoRepository;
	private final MinioClient minioClient;
	private final MinioConfig minioConfig;

	public ReportPhotoService(
			ReportRepository reportRepository,
			ReportReporterRepository reportReporterRepository,
			ReportPhotoRepository reportPhotoRepository,
			MinioClient minioClient,
			MinioConfig minioConfig) {
		this.reportRepository = reportRepository;
		this.reportReporterRepository = reportReporterRepository;
		this.reportPhotoRepository = reportPhotoRepository;
		this.minioClient = minioClient;
		this.minioConfig = minioConfig;
	}

	@Transactional(readOnly = true)
	public List<ReportPhotoResponse> list(Long reportId, AppUserDetails actor) {
		Report report = loadAndAuthorize(reportId, actor);
		return reportPhotoRepository.findByReportIdOrderBySortOrderAscCreatedAtAsc(reportId).stream()
				.map(this::toResponse)
				.toList();
	}

	@Transactional
	public ReportPhotoResponse upload(Long reportId, MultipartFile file, AppUserDetails actor) {
		Report report = loadAndAuthorize(reportId, actor);

		String contentType = file.getContentType();
		if (contentType == null || !ALLOWED_CONTENT_TYPES.contains(contentType.toLowerCase())) {
			throw new ApiException(HttpStatus.BAD_REQUEST.value(),
					"Only image uploads are allowed (jpeg, png, webp, gif, heic)");
		}
		if (file.getSize() <= 0 || file.getSize() > MAX_FILE_SIZE) {
			throw new ApiException(HttpStatus.BAD_REQUEST.value(),
					"File must be between 1 byte and 5 MB");
		}
		long existingCount = reportPhotoRepository.countByReportId(reportId);
		if (existingCount >= MAX_PHOTOS_PER_REPORT) {
			throw new ApiException(HttpStatus.BAD_REQUEST.value(),
					"Maximum 5 photos per report");
		}

		int sortOrder = (int) existingCount;
		String objectKey = "reports/" + reportId + "/" + UUID.randomUUID() + extension(contentType);

		try (InputStream stream = file.getInputStream()) {
			minioClient.putObject(
					PutObjectArgs.builder()
							.bucket(minioConfig.bucket())
							.object(objectKey)
							.stream(stream, -1, -1)
							.contentType(contentType)
							.build());
		} catch (Exception e) {
			log.error("MinIO upload failed for report {}: {}", reportId, e.getMessage(), e);
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

		return toResponse(photo);
	}

	@Transactional
	public void delete(Long reportId, Long photoId, AppUserDetails actor) {
		loadAndAuthorize(reportId, actor);

		ReportPhoto photo = reportPhotoRepository.findByIdAndReportId(photoId, reportId)
				.orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND.value(), "Photo not found"));

		// Best-effort MinIO cleanup
		try {
			minioClient.removeObject(RemoveObjectArgs.builder()
					.bucket(minioConfig.bucket())
					.object(photo.getObjectKey())
					.build());
		} catch (Exception e) {
			log.warn("MinIO delete failed for {}: {}", photo.getObjectKey(), e.getMessage());
		}

		reportPhotoRepository.delete(photo);

		// Re-sort remaining photos to keep sort_order gap-free
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

		String url;
		try {
			url = minioClient.getPresignedObjectUrl(
					GetPresignedObjectUrlArgs.builder()
							.method(Method.GET)
							.bucket(minioConfig.bucket())
							.object(photo.getObjectKey())
							.expiry(1, TimeUnit.HOURS)
							.build());
		} catch (Exception e) {
			log.error("Failed to generate presigned URL: {}", e.getMessage(), e);
			throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR.value(),
					"Failed to generate photo URL");
		}
		return Map.of("url", url);
	}

	/**
	 * Intended for ReportService.response() — returns presigned URLs so callers
	 * who can see the report can load photos directly.
	 */
	@Transactional(readOnly = true)
	public List<ReportPhotoResponse> listWithPresignedUrls(Long reportId) {
		return reportPhotoRepository.findByReportIdOrderBySortOrderAscCreatedAtAsc(reportId).stream()
				.map(this::toResponse)
				.toList();
	}

	private Report loadAndAuthorize(Long reportId, AppUserDetails actor) {
		Report report = reportRepository.findDetailedById(reportId)
				.orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND.value(), "Report not found"));

		// Site scoping — match ReportService.assertCanViewSite
		if (actor.getRole() != UserRole.super_admin) {
			if (actor.getSiteId() == null || !actor.getSiteId().equals(report.getSite().getId())) {
				throw new ApiException(HttpStatus.FORBIDDEN.value(),
						"Not allowed to view this site's reports");
			}
		}

		// Role gate — technicians and shop_managers cannot upload/delete photos
		switch (actor.getRole()) {
			case staff, admin, super_admin -> {
				// OK
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

		// Private reports: only sensitive audience can operate on photos, but we
		// shouldn't leak existence to same-site non-participants.
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

	private ReportPhotoResponse toResponse(ReportPhoto photo) {
		String presigned = null;
		try {
			presigned = minioClient.getPresignedObjectUrl(
					GetPresignedObjectUrlArgs.builder()
							.method(Method.GET)
							.bucket(minioConfig.bucket())
							.object(photo.getObjectKey())
							.expiry(1, TimeUnit.HOURS)
							.build());
		} catch (Exception e) {
			log.warn("Presigned URL generation failed for {}: {}", photo.getObjectKey(), e.getMessage());
		}
		return new ReportPhotoResponse(
				photo.getId(),
				photo.getObjectKey(),
				presigned,
				photo.getContentType(),
				photo.getFileSizeBytes(),
				photo.getSortOrder(),
				photo.getCreatedAt());
	}

	private String extension(String contentType) {
		return switch (contentType.toLowerCase()) {
			case "image/jpeg" -> ".jpg";
			case "image/png" -> ".png";
			case "image/webp" -> ".webp";
			case "image/gif" -> ".gif";
			case "image/heic" -> ".heic";
			default -> "";
		};
	}
}
