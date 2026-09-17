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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.example.fixflow.domain.SiteType;
import com.example.fixflow.dto.SiteRuleRequest;
import com.example.fixflow.dto.SiteRuleResponse;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.service.SiteRuleService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/site-rules")
public class SiteRuleController {

	private final SiteRuleService siteRuleService;

	public SiteRuleController(SiteRuleService siteRuleService) {
		this.siteRuleService = siteRuleService;
	}

	@GetMapping
	public List<SiteRuleResponse> list(@RequestParam(required = false) SiteType siteType) {
		if (siteType == null) {
			return siteRuleService.listAll();
		}
		return siteRuleService.listByType(siteType);
	}

	@PostMapping
	public ResponseEntity<SiteRuleResponse> create(
			@Valid @RequestBody SiteRuleRequest request,
			@AuthenticationPrincipal AppUserDetails principal
	) {
		return ResponseEntity.status(HttpStatus.CREATED).body(siteRuleService.create(request, principal));
	}

	@PutMapping("/{id}")
	public SiteRuleResponse update(
			@PathVariable Long id,
			@Valid @RequestBody SiteRuleRequest request,
			@AuthenticationPrincipal AppUserDetails principal
	) {
		return siteRuleService.update(id, request, principal);
	}

	@DeleteMapping("/{id}")
	public ResponseEntity<Void> delete(@PathVariable Long id, @AuthenticationPrincipal AppUserDetails principal) {
		siteRuleService.delete(id, principal);
		return ResponseEntity.noContent().build();
	}
}
