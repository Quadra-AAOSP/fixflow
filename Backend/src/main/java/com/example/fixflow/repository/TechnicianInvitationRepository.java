package com.example.fixflow.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import com.example.fixflow.domain.TechnicianInvitation;

public interface TechnicianInvitationRepository extends JpaRepository<TechnicianInvitation, Long> {
    boolean existsByReport_IdAndTechnician_Id(Long reportId, Long technicianId);
    Page<TechnicianInvitation> findByTechnician_IdOrderByCreatedAtDescIdDesc(Long technicianId, Pageable pageable);
}
