package com.example.fixflow.web;

import java.util.List;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.fixflow.dto.TechnicianSummaryResponse;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.service.TechnicianDirectoryService;

@RestController
@RequestMapping("/api/technicians")
public class TechnicianController {

	private final TechnicianDirectoryService technicianDirectoryService;

	public TechnicianController(TechnicianDirectoryService technicianDirectoryService) {
		this.technicianDirectoryService = technicianDirectoryService;
	}

	@GetMapping
	public List<TechnicianSummaryResponse> list(@AuthenticationPrincipal AppUserDetails principal) {
		return technicianDirectoryService.list(principal);
	}
}
