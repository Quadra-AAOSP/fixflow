package com.example.fixflow.service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.fixflow.audit.ReportReassignment;
import com.example.fixflow.audit.ReportReassignmentRepository;
import com.example.fixflow.domain.Report;
import com.example.fixflow.domain.ReportRating;
import com.example.fixflow.domain.ReportStatus;
import com.example.fixflow.domain.User;
import com.example.fixflow.domain.UserRole;
import com.example.fixflow.repository.ReportRatingRepository;
import com.example.fixflow.repository.ReportRepository;
import com.example.fixflow.repository.TechnicianContractRepository;
import com.example.fixflow.repository.UserRepository;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.web.ApiException;

@Service
@Transactional(readOnly = true)
public class TechnicianHistoryService {

	private final UserRepository users;
	private final ReportRepository reports;
	private final ReportRatingRepository ratings;
	private final ReportReassignmentRepository reassignments;
	private final TechnicianContractRepository contracts;

	public TechnicianHistoryService(
			UserRepository users,
			ReportRepository reports,
			ReportRatingRepository ratings,
			ReportReassignmentRepository reassignments,
			TechnicianContractRepository contracts) {
		this.users = users;
		this.reports = reports;
		this.ratings = ratings;
		this.reassignments = reassignments;
		this.contracts = contracts;
	}

	public record HistoryItem(
			String type,
			Long reportId,
			String category,
			String specialty,
			String status,
			Long agreedAmountMinor,
			String agreedCurrency,
			Integer ratingScore,
			String note,
			Instant at) {
	}

	public List<HistoryItem> history(Long technicianId, AppUserDetails actor) {
		assertCanView(technicianId, actor);
		User technician = users.findById(technicianId)
				.orElseThrow(() -> new ApiException(404, "Technician not found"));
		if (technician.getRole() != UserRole.technician) {
			throw new ApiException(404, "Technician not found");
		}
		List<HistoryItem> items = new ArrayList<>();
		for (Report report : reports.findDetailedByAssignedTechnicianId(technicianId)) {
			Integer score = ratings.findByResolution_Report_IdOrderByIdAsc(report.getId()).stream()
					.filter(r -> r.getRatedBy().getRole() == UserRole.reporter)
					.map(ReportRating::getScore)
					.findFirst()
					.orElse(null);
			items.add(new HistoryItem(
					report.getStatus() == ReportStatus.confirmed ? "completed" : "assignment",
					report.getId(),
					report.getCategory(),
					report.getSpecialty(),
					report.getStatus().name(),
					report.getAgreedAmountMinor(),
					report.getAgreedCurrency(),
					score,
					null,
					report.getUpdatedAt()));
		}
		for (ReportReassignment row : reassignments.findByFromTechnicianOrToTechnician(technicianId)) {
			String note = "Reassigned from #" + row.getFromTechnician().getId()
					+ " to "
					+ (row.getToTechnician() == null ? "unassigned" : ("#" + row.getToTechnician().getId()));
			items.add(new HistoryItem(
					"reassignment",
					row.getReport().getId(),
					row.getReport().getCategory(),
					row.getReport().getSpecialty(),
					null,
					null,
					null,
					null,
					note,
					row.getCreatedAt()));
		}
		items.sort(Comparator.comparing(HistoryItem::at, Comparator.nullsLast(Comparator.reverseOrder())));
		return items;
	}

	private void assertCanView(Long technicianId, AppUserDetails actor) {
		if (actor.getRole() == UserRole.technician && actor.getId().equals(technicianId)) {
			return;
		}
		if (actor.getRole() == UserRole.super_admin) {
			return;
		}
		if ((actor.getRole() == UserRole.admin || actor.getRole() == UserRole.staff)
				&& actor.getSiteId() != null
				&& contracts.existsByTechnician_IdAndSite_Id(technicianId, actor.getSiteId())) {
			return;
		}
		throw new ApiException(403, "Not allowed to view this technician history");
	}
}
