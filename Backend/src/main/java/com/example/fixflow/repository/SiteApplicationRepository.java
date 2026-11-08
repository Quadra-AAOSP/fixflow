package com.example.fixflow.repository;
import com.example.fixflow.domain.SiteApplication;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.*;
public interface SiteApplicationRepository extends JpaRepository<SiteApplication,Long> {
 @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select a from SiteApplication a where a.trackingHash=:hash")
 Optional<SiteApplication> lockTracking(@Param("hash") String hash);
 @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select a from SiteApplication a where a.id=:id")
 Optional<SiteApplication> lockId(@Param("id") Long id);
 @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select a from SiteApplication a where a.setupHash=:hash")
 Optional<SiteApplication> lockSetup(@Param("hash") String hash);
 List<SiteApplication> findAllByOrderByIdDesc();
}
