package com.example.fixflow.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ReopenReportRequest(
		@NotBlank(message = "Reopen reason is required")
		@Size(max = 500, message = "Reopen reason must be 500 characters or fewer")
		String reason
) {
}
