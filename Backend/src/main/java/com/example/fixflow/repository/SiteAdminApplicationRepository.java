package com.example.fixflow.repository;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import com.example.fixflow.domain.SiteAdminApplication;

public interface SiteAdminApplicationRepository extends JpaRepository<SiteAdminApplication, Long> {
    Optional<SiteAdminApplication> findByUser_Id(Long userId);
    List<SiteAdminApplication> findByStatusOrderByCreatedAtAsc(SiteAdminApplication.Status status);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from SiteAdminApplication a where a.id = :id")
    Optional<SiteAdminApplication> findForDecision(@Param("id") Long id);
}
