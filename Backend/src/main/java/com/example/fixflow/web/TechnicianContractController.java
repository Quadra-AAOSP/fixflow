package com.example.fixflow.web;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
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

	@PostMapping
	public ResponseEntity<TechnicianContractResponse> create(
			@Valid @RequestBody TechnicianContractRequest request,
			@AuthenticationPrincipal AppUserDetails principal
	) {
		return ResponseEntity.status(HttpStatus.CREATED).body(technicianContractService.create(request, principal));
	}
}
