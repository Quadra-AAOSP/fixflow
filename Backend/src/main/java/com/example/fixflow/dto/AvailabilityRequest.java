package com.example.fixflow.dto;

import com.example.fixflow.domain.AvailabilityStatus;

import jakarta.validation.constraints.NotNull;

public record AvailabilityRequest(
		@NotNull AvailabilityStatus status
) {
}
