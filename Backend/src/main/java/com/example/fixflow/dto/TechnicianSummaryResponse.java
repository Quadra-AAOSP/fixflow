package com.example.fixflow.dto;

import java.time.Instant;
import java.util.List;

public record TechnicianSummaryResponse(
		Long id,
		String firstName,
		String lastName,
		String email,
		String phone,
		String availabilityStatus,
		List<Skill> skills,
		List<Contract> contracts
) {
	public record Skill(
			Long id,
			String category,
			String specialty,
			int proficiency
	) {
	}

	public record Contract(
			Long siteId,
			String siteName,
			Instant createdAt
	) {
	}
}
