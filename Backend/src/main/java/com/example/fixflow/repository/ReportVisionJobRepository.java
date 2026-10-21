package com.example.fixflow.repository;

import java.util.List;
import java.time.Instant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import com.example.fixflow.domain.ReportVisionJob;

public interface ReportVisionJobRepository extends JpaRepository<ReportVisionJob, String> {
    List<ReportVisionJob> findTop10ByStatusOrderByCreatedAtAsc(String status);
    boolean existsByReportIdAndStatusIn(Long reportId, List<String> statuses);
    @Modifying
    @Query("update ReportVisionJob j set j.status='processing', j.attempts=j.attempts+1, j.updatedAt=:now where j.id=:id and j.status='queued'")
    int claim(@Param("id") String id, @Param("now") Instant now);
    @Modifying
    @Query("update ReportVisionJob j set j.status='queued' where j.status='processing' and j.updatedAt < :cutoff")
    int recover(@Param("cutoff") Instant cutoff);
}
