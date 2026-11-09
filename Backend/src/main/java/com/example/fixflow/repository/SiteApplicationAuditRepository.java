package com.example.fixflow.repository;
import com.example.fixflow.domain.SiteApplicationAudit;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface SiteApplicationAuditRepository extends JpaRepository<SiteApplicationAudit,Long>{List<SiteApplicationAudit> findByApplicationIdOrderByIdAsc(Long applicationId);}
