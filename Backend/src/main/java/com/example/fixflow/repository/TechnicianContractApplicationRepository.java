package com.example.fixflow.repository;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import com.example.fixflow.domain.TechnicianContractApplication;
import jakarta.persistence.LockModeType;

public interface TechnicianContractApplicationRepository extends JpaRepository<TechnicianContractApplication, Long> {
    boolean existsByTechnician_IdAndSite_Id(Long technicianId, Long siteId);
    List<TechnicianContractApplication> findByTechnician_IdOrderByCreatedAtDesc(Long technicianId);
    List<TechnicianContractApplication> findBySite_IdOrderByCreatedAtDesc(Long siteId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from TechnicianContractApplication a where a.id = :id")
    Optional<TechnicianContractApplication> lockById(@Param("id") Long id);
}
