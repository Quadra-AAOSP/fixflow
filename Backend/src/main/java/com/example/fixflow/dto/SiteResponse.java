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
		Long contractFlatFeeMinor,
		String contractFeeCurrency,
		String termsText,
		String contractTermsText,
		String termsDocumentName,
		String contractTermsDocumentName,
		boolean termsDocumentPresent,
		boolean contractTermsDocumentPresent,
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
				site.getContractFlatFeeMinor(),
				site.getContractFeeCurrency() == null ? "USD" : site.getContractFeeCurrency(),
				site.getTermsText(),
				site.getContractTermsText(),
				site.getTermsDocumentName(),
				site.getContractTermsDocumentName(),
				site.getTermsDocumentKey() != null && !site.getTermsDocumentKey().isBlank(),
				site.getContractTermsDocumentKey() != null && !site.getContractTermsDocumentKey().isBlank(),
				site.getCreatedAt(),
				site.getUpdatedAt()
		);
	}
}
