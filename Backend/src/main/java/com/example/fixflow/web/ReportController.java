package com.example.fixflow.web;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.example.fixflow.domain.ReportVisibility;
import com.example.fixflow.domain.Urgency;
import com.example.fixflow.dto.AssignTechnicianRequest;
import com.example.fixflow.dto.CreateReportRequest;
import com.example.fixflow.dto.ReopenReportRequest;
import com.example.fixflow.dto.ReportPageResponse;
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
			@RequestParam(required = false) ReportVisibility visibility,
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
				subsiteId,
				visibility
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

	@PostMapping("/{id}/confirm")
	public ReportResponse confirm(@PathVariable Long id, @AuthenticationPrincipal AppUserDetails principal) {
		return reportService.confirm(id, principal);
	}

	@PostMapping("/{id}/reopen")
	public ReportResponse reopen(
			@PathVariable Long id,
			@Valid @RequestBody ReopenReportRequest request,
			@AuthenticationPrincipal AppUserDetails principal
	) {
		return reportService.reopen(id, request, principal);
	}
}
