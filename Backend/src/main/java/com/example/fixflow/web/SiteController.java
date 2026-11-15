package com.example.fixflow.web;

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
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.example.fixflow.dto.SiteRequest;
import com.example.fixflow.dto.SiteResponse;
import com.example.fixflow.dto.SiteRuleResponse;
import com.example.fixflow.dto.TechnicianPoolMemberResponse;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.service.SiteDocumentService;
import com.example.fixflow.service.SiteService;
import com.example.fixflow.service.TechnicianPoolService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/sites")
public class SiteController {

	private final SiteService siteService;
	private final TechnicianPoolService technicianPoolService;
	private final SiteDocumentService siteDocuments;

	public SiteController(SiteService siteService, TechnicianPoolService technicianPoolService,
			SiteDocumentService siteDocuments) {
		this.siteService = siteService;
		this.technicianPoolService = technicianPoolService;
		this.siteDocuments = siteDocuments;
	}

	@GetMapping
	public List<SiteResponse> list(@AuthenticationPrincipal AppUserDetails principal) {
		return siteService.list(principal);
	}

	@GetMapping("/{id}")
	public SiteResponse get(@PathVariable Long id, @AuthenticationPrincipal AppUserDetails principal) {
		return siteService.get(id, principal);
	}

	@GetMapping("/{id}/taxonomy")
	public List<SiteRuleResponse> taxonomy(
			@PathVariable Long id,
			@AuthenticationPrincipal AppUserDetails principal
	) {
		return siteService.taxonomy(id, principal);
	}

	@GetMapping("/{id}/technician-pool")
	public List<TechnicianPoolMemberResponse> technicianPool(
			@PathVariable Long id,
			@AuthenticationPrincipal AppUserDetails principal
	) {
		return technicianPoolService.eligiblePool(id, principal);
	}

	@PostMapping
	public ResponseEntity<SiteResponse> create(
			@Valid @RequestBody SiteRequest request,
			@AuthenticationPrincipal AppUserDetails principal
	) {
		return ResponseEntity.status(HttpStatus.CREATED).body(siteService.create(request, principal));
	}

	@PutMapping("/{id}")
	public SiteResponse update(
			@PathVariable Long id,
			@Valid @RequestBody SiteRequest request,
			@AuthenticationPrincipal AppUserDetails principal
	) {
		return siteService.update(id, request, principal);
	}

	@DeleteMapping("/{id}")
	public ResponseEntity<Void> delete(@PathVariable Long id, @AuthenticationPrincipal AppUserDetails principal) {
		siteService.delete(id, principal);
		return ResponseEntity.noContent().build();
	}

	@PostMapping(path = "/{id}/documents/{kind}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	public ResponseEntity<SiteResponse> uploadDocument(
			@PathVariable Long id,
			@PathVariable String kind,
			@RequestParam("file") MultipartFile file,
			@AuthenticationPrincipal AppUserDetails principal
	) {
		return ResponseEntity.status(HttpStatus.CREATED)
				.body(siteDocuments.upload(id, parseKind(kind), file, principal));
	}

	@GetMapping("/{id}/documents/{kind}")
	public ResponseEntity<InputStreamResource> downloadDocument(
			@PathVariable Long id,
			@PathVariable String kind,
			@AuthenticationPrincipal AppUserDetails principal
	) {
		SiteDocumentService.Kind documentKind = parseKind(kind);
		String filename = siteDocuments.filename(id, documentKind, principal);
		return ResponseEntity.ok()
				.cacheControl(org.springframework.http.CacheControl.noStore())
				.header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
				.contentType(MediaType.parseMediaType(siteDocuments.contentType(id, documentKind, principal)))
				.body(new InputStreamResource(siteDocuments.content(id, documentKind, principal)));
	}

	private static SiteDocumentService.Kind parseKind(String kind) {
		try {
			return SiteDocumentService.Kind.valueOf(kind.trim().toLowerCase());
		} catch (Exception ex) {
			throw new com.example.fixflow.web.ApiException(400, "Document kind must be terms or contract");
		}
	}
}
