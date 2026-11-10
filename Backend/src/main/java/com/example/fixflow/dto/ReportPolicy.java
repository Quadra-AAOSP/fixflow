package com.example.fixflow.dto;

import com.example.fixflow.domain.Report;
import com.example.fixflow.domain.ReportStatus;
import com.example.fixflow.domain.Urgency;

public record ReportPolicy(String statusGroup, Urgency effectiveUrgency, boolean urgent,
        boolean inAssignmentQueue, boolean participant, boolean canSeeSensitive,
        boolean canAssign, boolean canJoin, boolean canEdit, boolean canDelete) {
    public static ReportPolicy from(Report report, boolean sensitive, boolean participant,
            boolean assign, boolean join, boolean ownQueue) {
        return from(report, sensitive, participant, assign, join, ownQueue, false, false);
    }

    public static ReportPolicy from(Report report, boolean sensitive, boolean participant,
            boolean assign, boolean join, boolean ownQueue, boolean edit, boolean delete) {
        String group = switch (report.getStatus()) {
            case confirmed, resolved_pending_confirmation -> "resolved";
            case assigned, in_progress -> "progress";
            default -> "open";
        };
        Urgency urgency = report.getEffectiveUrgency();
        boolean unresolved = report.getStatus() != ReportStatus.confirmed
                && report.getStatus() != ReportStatus.resolved_pending_confirmation;
        return new ReportPolicy(group, urgency, unresolved && (urgency == Urgency.high || urgency == Urgency.critical),
                unresolved && report.getAssignedTechnician() != null && ownQueue,
                participant, sensitive, assign, join, edit, delete);
    }
}
