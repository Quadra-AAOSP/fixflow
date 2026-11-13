package com.example.fixflow.audit;

import org.springframework.data.jpa.repository.JpaRepository;

public interface TechnicianRankingAuditRepository extends JpaRepository<TechnicianRankingAudit, Long> {
}
