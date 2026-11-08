package com.example.fixflow.dto;

import com.example.fixflow.domain.ReportVisibility;
import com.example.fixflow.domain.Urgency;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Size;

/**
 * Field-edit payload for an existing report. Every field is optional, but an
 * empty body is rejected: an edit that changes nothing would only add noise to
 * the status history.
 */
public record UpdateReportRequest(
		@Size(max = 10000) String description,
		@Size(max = 512) String address,
		@Size(max = 128) String category,
		@Size(max = 128) String specialty,
		Urgency reporterUrgency,
		ReportVisibility visibility
) {
	@AssertTrue(message = "At least one field must be provided")
	public boolean isAtLeastOneFieldProvided() {
		return description != null || address != null || category != null
				|| specialty != null || reporterUrgency != null || visibility != null;
	}
}
