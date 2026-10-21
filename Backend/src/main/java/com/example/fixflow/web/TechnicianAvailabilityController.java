package com.example.fixflow.web;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.fixflow.dto.AvailabilityRequest;
import com.example.fixflow.dto.AvailabilityResponse;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.service.TechnicianAvailabilityService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/technicians/me/availability")
public class TechnicianAvailabilityController {

	private final TechnicianAvailabilityService availabilityService;

	public TechnicianAvailabilityController(TechnicianAvailabilityService availabilityService) {
		this.availabilityService = availabilityService;
	}

	@GetMapping
	public AvailabilityResponse get(@AuthenticationPrincipal AppUserDetails principal) {
		return availabilityService.getMine(principal);
	}

	@PutMapping
	public AvailabilityResponse put(
			@Valid @RequestBody AvailabilityRequest request,
			@AuthenticationPrincipal AppUserDetails principal
	) {
		return availabilityService.updateMine(request, principal);
	}
}
