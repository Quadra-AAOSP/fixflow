package com.example.fixflow.web;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.fixflow.dto.SiteRequest;
import com.example.fixflow.dto.SiteResponse;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.service.SiteService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/sites")
public class SiteController {

	private final SiteService siteService;

	public SiteController(SiteService siteService) {
		this.siteService = siteService;
	}

	@GetMapping
	public List<SiteResponse> list(@AuthenticationPrincipal AppUserDetails principal) {
		return siteService.list(principal);
	}

	@GetMapping("/{id}")
	public SiteResponse get(@PathVariable Long id, @AuthenticationPrincipal AppUserDetails principal) {
		return siteService.get(id, principal);
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
}
