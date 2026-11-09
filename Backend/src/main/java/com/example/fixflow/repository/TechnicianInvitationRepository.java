package com.example.fixflow.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import com.example.fixflow.domain.TechnicianInvitation;

public interface TechnicianInvitationRepository extends JpaRepository<TechnicianInvitation, Long> {
    java.util.Optional<TechnicianInvitation> findByReport_IdAndTechnician_Id(Long reportId, Long technicianId);
    java.util.Optional<TechnicianInvitation> findByIdAndTechnician_Id(Long id, Long technicianId);
    boolean existsByReport_IdAndTechnician_Id(Long reportId, Long technicianId);
    Page<TechnicianInvitation> findByTechnician_IdOrderByCreatedAtDescIdDesc(Long technicianId, Pageable pageable);
}
