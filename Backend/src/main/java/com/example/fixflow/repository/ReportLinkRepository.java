package com.example.fixflow.repository;
import com.example.fixflow.domain.ReportLink;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface ReportLinkRepository extends JpaRepository<ReportLink,Long> {
 boolean existsByReport_IdAndLinkedReport_Id(Long reportId,Long linkedReportId);
 List<ReportLink> findByReport_IdOrLinkedReport_IdOrderByIdAsc(Long reportId,Long linkedReportId);
}
