package com.example.fixflow.repository;
import com.example.fixflow.domain.TechnicianVerificationAudit;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface TechnicianVerificationAuditRepository extends JpaRepository<TechnicianVerificationAudit,Long> {
 List<TechnicianVerificationAudit> findByTechnicianIdOrderByIdAsc(Long technicianId);
}
