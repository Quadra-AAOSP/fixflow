package com.example.fixflow.web;

import java.util.List;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.fixflow.dto.TechnicianSummaryResponse;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.service.TechnicianDirectoryService;
import com.example.fixflow.service.TechnicianHistoryService;

@RestController
@RequestMapping("/api/technicians")
public class TechnicianController {

	private final TechnicianDirectoryService technicianDirectoryService;
	private final TechnicianHistoryService historyService;

	public TechnicianController(
			TechnicianDirectoryService technicianDirectoryService,
			TechnicianHistoryService historyService) {
		this.technicianDirectoryService = technicianDirectoryService;
		this.historyService = historyService;
	}

	@GetMapping
	public List<TechnicianSummaryResponse> list(@AuthenticationPrincipal AppUserDetails principal) {
		return technicianDirectoryService.list(principal);
	}

	@GetMapping("/{id}/history")
	public List<TechnicianHistoryService.HistoryItem> history(
			@PathVariable Long id, @AuthenticationPrincipal AppUserDetails principal) {
		return historyService.history(id, principal);
	}
}
