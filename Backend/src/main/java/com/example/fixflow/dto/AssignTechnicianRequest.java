package com.example.fixflow.dto;

import jakarta.validation.constraints.NotNull;

public record AssignTechnicianRequest(
		@NotNull Long technicianId
) {
}
