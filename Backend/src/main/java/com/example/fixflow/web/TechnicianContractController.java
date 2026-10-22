package com.example.fixflow.web;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.example.fixflow.dto.TechnicianContractRequest;
import com.example.fixflow.dto.TechnicianContractResponse;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.service.TechnicianContractService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/technician-contracts")
public class TechnicianContractController {

	private final TechnicianContractService technicianContractService;

	public TechnicianContractController(TechnicianContractService technicianContractService) {
		this.technicianContractService = technicianContractService;
	}

	@GetMapping
	public List<TechnicianContractResponse> list(
			@RequestParam(required = false) Long siteId,
			@AuthenticationPrincipal AppUserDetails principal
	) {
		return technicianContractService.list(siteId, principal);
	}

	@PostMapping
	public ResponseEntity<TechnicianContractResponse> create(
			@Valid @RequestBody TechnicianContractRequest request,
			@AuthenticationPrincipal AppUserDetails principal
	) {
		return ResponseEntity.status(HttpStatus.CREATED).body(technicianContractService.create(request, principal));
	}

	@DeleteMapping("/{id}")
	public ResponseEntity<Void> delete(
			@PathVariable Long id,
			@AuthenticationPrincipal AppUserDetails principal
	) {
		technicianContractService.delete(id, principal);
		return ResponseEntity.noContent().build();
	}
}
