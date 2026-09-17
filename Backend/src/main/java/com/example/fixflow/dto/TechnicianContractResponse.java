package com.example.fixflow.dto;

import java.time.Instant;

import com.example.fixflow.domain.TechnicianContract;

public record TechnicianContractResponse(
		Long id,
		Long technicianId,
		Long siteId,
		Instant createdAt
) {
	public static TechnicianContractResponse from(TechnicianContract contract) {
		return new TechnicianContractResponse(
				contract.getId(),
				contract.getTechnician().getId(),
				contract.getSite().getId(),
				contract.getCreatedAt()
		);
	}
}
