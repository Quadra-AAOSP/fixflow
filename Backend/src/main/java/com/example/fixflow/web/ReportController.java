package com.example.fixflow.web;

import java.io.InputStream;
import java.util.List;

import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.example.fixflow.domain.ReportPhoto;
import com.example.fixflow.domain.Urgency;
import com.example.fixflow.dto.AssignTechnicianRequest;
import com.example.fixflow.dto.CreateReportRequest;
import com.example.fixflow.dto.ReportPageResponse;
import com.example.fixflow.dto.ReportPhotoResponse;
import com.example.fixflow.dto.ReportReporterResponse;
import com.example.fixflow.dto.ReportResponse;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.service.ReportService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/reports")
public class ReportController {

	private final ReportService reportService;

	public ReportController(ReportService reportService) {
		this.reportService = reportService;
	}

	@PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<ReportResponse> create(
			@Valid @RequestBody CreateReportRequest request,
			@AuthenticationPrincipal AppUserDetails principal
	) {
		return ResponseEntity.status(HttpStatus.CREATED).body(reportService.create(request, principal));
	}

	@PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	public ResponseEntity<ReportResponse> createMultipart(
			@RequestParam String description,
			@RequestParam String category,
			@RequestParam Urgency reporterUrgency,
			@RequestParam(required = false) String address,
			@RequestParam(required = false) String specialty,
			@RequestParam(required = false) String reporterReason,
			@RequestParam(required = false) Long siteId,
			@RequestParam(required = false) Long subsiteId,
			@RequestPart(value = "photos", required = false) List<MultipartFile> photos,
			@RequestParam(value = "file", required = false) List<MultipartFile> files,
			@AuthenticationPrincipal AppUserDetails principal
	) {
		CreateReportRequest request = new CreateReportRequest(
				description,
				address,
				category,
				specialty,
				reporterUrgency,
				reporterReason,
				siteId,
				subsiteId
		);
		List<MultipartFile> uploads = photos != null && !photos.isEmpty() ? photos : files;
		return ResponseEntity.status(HttpStatus.CREATED)
				.body(reportService.createMultipart(request, uploads, principal));
	}

	@GetMapping
	public ReportPageResponse list(
			@RequestParam(required = false) Long siteId,
			@RequestParam(required = false) String category,
			@RequestParam(defaultValue = "0") int page,
			@RequestParam(defaultValue = "20") int size,
			@AuthenticationPrincipal AppUserDetails principal
	) {
		return reportService.list(siteId, category, page, size, principal);
	}

	@GetMapping("/{id}")
	public ReportResponse get(@PathVariable Long id, @AuthenticationPrincipal AppUserDetails principal) {
		return reportService.get(id, principal);
	}

	@PostMapping("/{id}/classify")
	public ReportResponse classify(@PathVariable Long id, @AuthenticationPrincipal AppUserDetails principal) {
		return reportService.classify(id, principal);
	}

	@PostMapping("/{id}/join")
	public ReportResponse join(@PathVariable Long id, @AuthenticationPrincipal AppUserDetails principal) {
		return reportService.join(id, principal);
	}

	@GetMapping("/{id}/reporters")
	public List<ReportReporterResponse> reporters(
			@PathVariable Long id,
			@AuthenticationPrincipal AppUserDetails principal
	) {
		return reportService.listReporters(id, principal);
	}

	@PostMapping("/{id}/assign")
	public ReportResponse assign(
			@PathVariable Long id,
			@Valid @RequestBody AssignTechnicianRequest request,
			@AuthenticationPrincipal AppUserDetails principal
	) {
		return reportService.assign(id, request, principal);
	}

	@PostMapping(value = "/{id}/photos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	public ResponseEntity<List<ReportPhotoResponse>> addPhotos(
			@PathVariable Long id,
			@RequestPart(value = "photos", required = false) List<MultipartFile> photos,
			@RequestParam(value = "file", required = false) List<MultipartFile> files,
			@AuthenticationPrincipal AppUserDetails principal
	) {
		List<MultipartFile> uploads = photos != null && !photos.isEmpty() ? photos : files;
		return ResponseEntity.status(HttpStatus.CREATED).body(reportService.addPhotos(id, uploads, principal));
	}

	@GetMapping("/{id}/photos/{photoId}")
	public ResponseEntity<InputStreamResource> getPhoto(
			@PathVariable Long id,
			@PathVariable Long photoId,
			@AuthenticationPrincipal AppUserDetails principal
	) throws Exception {
		ReportPhoto photo = reportService.requirePhoto(id, photoId, principal);
		InputStream stream = reportService.openPhotoStream(id, photoId, principal);
		MediaType mediaType = photo.getContentType() == null
				? MediaType.APPLICATION_OCTET_STREAM
				: MediaType.parseMediaType(photo.getContentType());
		return ResponseEntity.ok()
				.header(HttpHeaders.CACHE_CONTROL, "private, max-age=300")
				.contentType(mediaType)
				.body(new InputStreamResource(stream));
	}

	@GetMapping("/{id}/photos/{photoId}/url")
	public ResponseEntity<java.util.Map<String, String>> getPhotoUrl(
			@PathVariable Long id,
			@PathVariable Long photoId,
			@AuthenticationPrincipal AppUserDetails principal
	) {
		String url = reportService.photoDownloadUrl(id, photoId, principal);
		return ResponseEntity.ok(java.util.Map.of("url", url));
	}

	@DeleteMapping("/{id}/photos/{photoId}")
	public ResponseEntity<Void> deletePhoto(
			@PathVariable Long id,
			@PathVariable Long photoId,
			@AuthenticationPrincipal AppUserDetails principal
	) {
		reportService.deletePhoto(id, photoId, principal);
		return ResponseEntity.noContent().build();
	}
}
