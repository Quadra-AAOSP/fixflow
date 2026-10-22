package com.example.fixflow.dto;

import java.time.Instant;

import com.example.fixflow.domain.AvailabilityStatus;

public record AvailabilityResponse(
		Long technicianId,
		AvailabilityStatus status,
		Instant updatedAt
) {
}
