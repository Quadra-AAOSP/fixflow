package com.example.fixflow.repository;
import com.example.fixflow.domain.ReportRating;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface ReportRatingRepository extends JpaRepository<ReportRating,Long> {
 boolean existsByResolution_IdAndRatedBy_Id(Long resolutionId,Long userId);
 List<ReportRating> findByResolution_Report_IdOrderByIdAsc(Long reportId);
}
