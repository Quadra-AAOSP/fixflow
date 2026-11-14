package com.example.fixflow.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Structured trade skill captured during technician self-registration. Proficiency is platform-managed. */
public record RegisterSkillRequest(
		@NotBlank @Size(max = 128) String category,
		@Size(max = 128) String specialty
) {
}
