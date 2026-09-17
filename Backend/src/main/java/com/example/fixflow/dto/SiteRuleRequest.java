package com.example.fixflow.dto;

import com.example.fixflow.domain.SiteType;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record SiteRuleRequest(
		@NotNull SiteType siteType,
		@NotBlank @Size(max = 128) String category,
		@NotNull Integer urgencyWeight,
		@NotNull Integer sortOrder
) {
}
