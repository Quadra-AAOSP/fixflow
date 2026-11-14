package com.example.fixflow.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Proficiency is platform-managed and ignored if supplied. */
public record TechnicianSkillRequest(
		@NotNull Long technicianId,
		@NotBlank @Size(max = 128) String category,
		@Size(max = 128) String specialty
) {
}
