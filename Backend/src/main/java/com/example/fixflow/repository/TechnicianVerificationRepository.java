package com.example.fixflow.repository;
import com.example.fixflow.domain.TechnicianVerification;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TechnicianVerificationRepository extends JpaRepository<TechnicianVerification,Long> {
    @Lock(LockModeType.PESSIMISTIC_READ)
    @Query("select v from TechnicianVerification v where v.technicianId = :id")
    Optional<TechnicianVerification> findForMarketplace(@Param("id") Long id);
}
