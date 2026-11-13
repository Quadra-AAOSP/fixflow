package com.example.fixflow.audit;

import org.springframework.data.jpa.repository.JpaRepository;

public interface MarketplaceAuditRepository extends JpaRepository<MarketplaceAudit, Long> {
}
