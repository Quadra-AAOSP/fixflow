package com.example.fixflow.dto;

import java.time.Instant;

import com.example.fixflow.domain.ContractStatus;
import com.example.fixflow.domain.Site;
import com.example.fixflow.domain.SiteType;

public record SiteResponse(
		Long id,
		String name,
		SiteType type,
		ContractStatus contractStatus,
		String address,
		String description,
		String imageUrl,
		Instant createdAt,
		Instant updatedAt
) {
	public static SiteResponse from(Site site) {
		return new SiteResponse(
				site.getId(),
				site.getName(),
				site.getType(),
				site.getContractStatus(),
				site.getAddress(),
				site.getDescription(),
				site.getImageUrl(),
				site.getCreatedAt(),
				site.getUpdatedAt()
		);
	}
}
