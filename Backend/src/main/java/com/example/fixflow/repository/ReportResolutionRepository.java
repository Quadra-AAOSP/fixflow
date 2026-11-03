package com.example.fixflow.repository;
import com.example.fixflow.domain.ReportResolution;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface ReportResolutionRepository extends JpaRepository<ReportResolution,Long> {
 List<ReportResolution> findByReport_IdOrderByIdAsc(Long reportId);
}
