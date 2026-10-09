package com.example.fixflow.dto;

import com.example.fixflow.domain.Urgency;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateReportRequest(
		@NotBlank @Size(max = 10000) String description,
		@Size(max = 512) String address,
		@NotBlank @Size(max = 128) String category,
		@Size(max = 128) String specialty,
		@NotNull Urgency reporterUrgency,
		@Size(max = 2000) String reporterReason,
		Long siteId,
        @jakarta.validation.constraints.Positive Long subsiteId
) {
}
