package com.example.fixflow.dto;

import com.example.fixflow.domain.AvailabilityStatus;

public record TechnicianPoolMemberResponse(
		Long technicianId,
		String firstName,
		String lastName,
		String email,
		AvailabilityStatus availability,
		boolean contracted
) {
}
