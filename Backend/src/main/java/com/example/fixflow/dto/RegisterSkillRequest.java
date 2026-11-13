package com.example.fixflow.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Structured trade skill captured during technician self-registration. */
public record RegisterSkillRequest(
		@NotBlank @Size(max = 128) String category,
		@Size(max = 128) String specialty,
		@Min(1) @Max(5) Integer proficiency
) {
}
