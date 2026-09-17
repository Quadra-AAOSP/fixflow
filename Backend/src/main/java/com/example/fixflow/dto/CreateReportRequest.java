package com.example.fixflow.dto;

import com.example.fixflow.domain.Urgency;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateReportRequest(
		@NotBlank String description,
		@Size(max = 512) String address,
		@NotBlank @Size(max = 128) String category,
		@Size(max = 128) String specialty,
		@NotNull Urgency reporterUrgency,
		String reporterReason,
		Long siteId
) {
}
