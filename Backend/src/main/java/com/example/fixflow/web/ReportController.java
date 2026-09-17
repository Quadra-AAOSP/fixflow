package com.example.fixflow.web;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.example.fixflow.dto.AssignTechnicianRequest;
import com.example.fixflow.dto.CreateReportRequest;
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

	@PostMapping
	public ResponseEntity<ReportResponse> create(
			@Valid @RequestBody CreateReportRequest request,
			@AuthenticationPrincipal AppUserDetails principal
	) {
		return ResponseEntity.status(HttpStatus.CREATED).body(reportService.create(request, principal));
	}

	@GetMapping
	public List<ReportResponse> list(
			@RequestParam(required = false) Long siteId,
			@AuthenticationPrincipal AppUserDetails principal
	) {
		return reportService.list(siteId, principal);
	}

	@GetMapping("/{id}")
	public ReportResponse get(@PathVariable Long id, @AuthenticationPrincipal AppUserDetails principal) {
		return reportService.get(id, principal);
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
}
