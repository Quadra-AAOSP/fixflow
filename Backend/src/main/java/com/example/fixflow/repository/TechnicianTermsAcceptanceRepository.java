package com.example.fixflow.repository;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import com.example.fixflow.domain.TechnicianTermsAcceptance;

public interface TechnicianTermsAcceptanceRepository extends JpaRepository<TechnicianTermsAcceptance, Long> {
    boolean existsByTechnician_IdAndTermsVersion(Long technicianId, String termsVersion);
    List<TechnicianTermsAcceptance> findByTechnician_IdOrderByAcceptedAtDesc(Long technicianId);
}
