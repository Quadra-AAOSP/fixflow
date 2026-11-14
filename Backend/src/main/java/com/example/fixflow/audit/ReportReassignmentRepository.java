package com.example.fixflow.audit;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReportReassignmentRepository extends JpaRepository<ReportReassignment, Long> {
	List<ReportReassignment> findByReport_IdOrderByCreatedAtAsc(Long reportId);

	@Query("""
			select r from ReportReassignment r
			where r.fromTechnician.id = :technicianId or r.toTechnician.id = :technicianId
			order by r.createdAt desc
			""")
	List<ReportReassignment> findByFromTechnicianOrToTechnician(@Param("technicianId") Long technicianId);
}
