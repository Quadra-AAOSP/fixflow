package com.example.fixflow.dto;

import java.time.Instant;
import com.example.fixflow.domain.TechnicianContractApplication;

public record ContractApplicationResponse(Long id, Long technicianId, Long siteId,
        TechnicianContractApplication.Status status, String note, String decisionReason,
        Long decidedByUserId, Instant createdAt, Instant decidedAt) {
    public static ContractApplicationResponse from(TechnicianContractApplication a) {
        return new ContractApplicationResponse(a.getId(), a.getTechnician().getId(), a.getSite().getId(),
                a.getStatus(), a.getNote(), a.getDecisionReason(),
                a.getDecidedBy() == null ? null : a.getDecidedBy().getId(), a.getCreatedAt(), a.getDecidedAt());
    }
}
