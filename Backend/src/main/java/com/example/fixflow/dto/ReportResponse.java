package com.example.fixflow.dto;

import java.time.Instant;
import java.util.List;

import com.example.fixflow.domain.Report;
import com.example.fixflow.domain.ReportStatus;
import com.example.fixflow.domain.ReportVisibility;
import com.example.fixflow.domain.Urgency;

public record ReportResponse(
		Long id,
		Long siteId,
        Long subsiteId,
		Long createdByUserId,
		String createdByName,
		String description,
		String address,
		String category,
		String specialty,
		Urgency aiUrgency,
		Urgency reporterUrgency,
		String reporterReason,
		Urgency finalUrgency,
		ReportStatus status,
		Long assignedTechnicianId,
		boolean editable,
		int reopenCount,
		String reopenReason,
		Long confirmedByUserId,
		String confirmedByName,
		Instant confirmedAt,
		ReportVisibility visibility,
        List<ReportPhotoResponse> photos,
		Instant createdAt,
		Instant updatedAt,
        ReportPolicy policy
) {
	public static ReportResponse from(Report report, ReportPolicy policy,
			List<ReportPhotoResponse> photos) {
        boolean includeSensitive = policy.canSeeSensitive();
		Long createdById = null;
		String createdByName = null;
		String address = null;
		if (includeSensitive && report.getCreatedBy() != null) {
			createdById = report.getCreatedBy().getId();
			createdByName = report.getCreatedBy().getFirstName() + " " + report.getCreatedBy().getLastName();
			address = report.getAddress();
		}
		Long confirmedById = null;
		String confirmedByName = null;
		if (includeSensitive && report.getConfirmedBy() != null) {
			confirmedById = report.getConfirmedBy().getId();
			confirmedByName = report.getConfirmedBy().getFirstName() + " " + report.getConfirmedBy().getLastName();
		}
		return new ReportResponse(
				report.getId(),
				report.getSite() != null ? report.getSite().getId() : null,
                report.getSubsite() != null ? report.getSubsite().getId() : null,
				createdById,
				createdByName,
				report.getDescription(),
				address,
				report.getCategory(),
				report.getSpecialty(),
				report.getAiUrgency(),
				report.getReporterUrgency(),
				includeSensitive ? report.getReporterReason() : null,
				report.getFinalUrgency(),
				report.getStatus(),
				report.getAssignedTechnician() != null ? report.getAssignedTechnician().getId() : null,
				report.isEditable(),
				report.getReopenCount(),
				includeSensitive ? report.getReopenReason() : null,
				confirmedById,
				confirmedByName,
				includeSensitive ? report.getConfirmedAt() : null,
				report.getVisibility(),
                photos,
				report.getCreatedAt(),
				report.getUpdatedAt(),
                policy
			);
	}
}
