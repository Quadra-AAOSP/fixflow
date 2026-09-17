package com.example.fixflow.web;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.fixflow.dto.TechnicianSkillRequest;
import com.example.fixflow.dto.TechnicianSkillResponse;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.service.TechnicianSkillService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/technician-skills")
public class TechnicianSkillController {

	private final TechnicianSkillService technicianSkillService;

	public TechnicianSkillController(TechnicianSkillService technicianSkillService) {
		this.technicianSkillService = technicianSkillService;
	}

	@PostMapping
	public ResponseEntity<TechnicianSkillResponse> create(
			@Valid @RequestBody TechnicianSkillRequest request,
			@AuthenticationPrincipal AppUserDetails principal
	) {
		return ResponseEntity.status(HttpStatus.CREATED).body(technicianSkillService.create(request, principal));
	}
}
