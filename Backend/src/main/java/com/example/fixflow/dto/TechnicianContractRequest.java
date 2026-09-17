package com.example.fixflow.dto;

import jakarta.validation.constraints.NotNull;

public record TechnicianContractRequest(
		@NotNull Long technicianId,
		@NotNull Long siteId
) {
}
