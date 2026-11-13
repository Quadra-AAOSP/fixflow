package com.example.fixflow.audit;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface SiteApplicationAuditRepository extends JpaRepository<SiteApplicationAudit, Long> {
	List<SiteApplicationAudit> findByApplicationIdOrderByIdAsc(Long applicationId);
}
