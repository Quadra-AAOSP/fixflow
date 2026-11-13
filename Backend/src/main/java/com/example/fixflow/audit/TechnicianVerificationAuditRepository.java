package com.example.fixflow.audit;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface TechnicianVerificationAuditRepository extends JpaRepository<TechnicianVerificationAudit, Long> {
	List<TechnicianVerificationAudit> findByTechnicianIdOrderByIdAsc(Long technicianId);
}
