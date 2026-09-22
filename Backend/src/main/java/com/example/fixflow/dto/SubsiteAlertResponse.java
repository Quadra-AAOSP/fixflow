package com.example.fixflow.dto;
import java.time.Instant;
import com.example.fixflow.domain.SubsiteRequest;
public record SubsiteAlertResponse(Long id, Long siteId, Long requestedByUserId, String note, String status, Instant createdAt) {
    public static SubsiteAlertResponse from(SubsiteRequest request) { return new SubsiteAlertResponse(request.getId(), request.getSite().getId(), request.getRequestedBy().getId(), request.getNote(), request.getStatus().name(), request.getCreatedAt()); }
}
