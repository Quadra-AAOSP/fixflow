package com.example.fixflow.realtime;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import com.example.fixflow.domain.ReportStatus;

/** Immutable domain fact. Publish inside the transaction that saves the transition. */
public record ReportDomainEvent(UUID eventId, String eventType, int schemaVersion, Instant occurredAt,
        Long siteId, Long reportId, ReportStatus previousStatus, ReportStatus status,
        Long previousAssigneeId, Long assigneeId) {
    public static final String ASSIGNMENT = "report.assignment.v1";
    public static final String STATUS_CHANGE = "report.status-changed.v1";
    public static final String PENDING_RESOLUTION = "report.pending-resolution.v1";
    public static final String CONFIRMATION = "report.confirmation.v1";
    public static final String REASSIGNMENT = "report.reassignment.v1";

    public ReportDomainEvent {
        Objects.requireNonNull(eventId); Objects.requireNonNull(occurredAt);
        Objects.requireNonNull(previousStatus); Objects.requireNonNull(status);
        if (schemaVersion != 1 || siteId == null || siteId <= 0 || reportId == null || reportId <= 0
                || !java.util.Set.of(ASSIGNMENT, STATUS_CHANGE, PENDING_RESOLUTION, CONFIRMATION,
                        REASSIGNMENT).contains(eventType)) {
            throw new IllegalArgumentException("Invalid report event envelope");
        }
    }

    public static ReportDomainEvent of(String type, Long siteId, Long reportId,
            ReportStatus before, ReportStatus after, Long oldAssignee, Long newAssignee) {
        return new ReportDomainEvent(UUID.randomUUID(), type, 1, Instant.now(), siteId, reportId,
                before, after, oldAssignee, newAssignee);
    }
}
