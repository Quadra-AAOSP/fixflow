package com.example.fixflow.dto;

import com.example.fixflow.domain.ContractStatus;
import com.example.fixflow.domain.SiteType;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record SiteRequest(
		@NotBlank @Size(max = 255) String name,
		@NotNull SiteType type,
		@NotNull ContractStatus contractStatus,
		@Size(max = 512) String address,
		String description,
		@Size(max = 1024) String imageUrl
) {
}
