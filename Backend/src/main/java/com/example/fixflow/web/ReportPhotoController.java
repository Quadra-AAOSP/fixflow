package com.example.fixflow.web;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.example.fixflow.dto.ReportPhotoResponse;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.service.ReportPhotoService;

@RestController
@RequestMapping("/api/reports/{id}/photos")
public class ReportPhotoController {

	private final ReportPhotoService reportPhotoService;

	public ReportPhotoController(ReportPhotoService reportPhotoService) {
		this.reportPhotoService = reportPhotoService;
	}

	@GetMapping
	public List<ReportPhotoResponse> list(
			@PathVariable Long id,
			@AuthenticationPrincipal AppUserDetails principal) {
		return reportPhotoService.list(id, principal);
	}

	@PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	public ResponseEntity<ReportPhotoResponse> upload(
			@PathVariable Long id,
			@RequestParam("file") MultipartFile file,
			@AuthenticationPrincipal AppUserDetails principal) {
		return ResponseEntity.status(HttpStatus.CREATED)
				.body(reportPhotoService.upload(id, file, principal));
	}

	@DeleteMapping("/{photoId}")
	public ResponseEntity<Void> delete(
			@PathVariable Long id,
			@PathVariable Long photoId,
			@AuthenticationPrincipal AppUserDetails principal) {
		reportPhotoService.delete(id, photoId, principal);
		return ResponseEntity.noContent().build();
	}

	@GetMapping("/{photoId}")
	public Map<String, String> presignedUrl(
			@PathVariable Long id,
			@PathVariable Long photoId,
			@AuthenticationPrincipal AppUserDetails principal) {
		return reportPhotoService.presignedUrl(id, photoId, principal);
	}
}
