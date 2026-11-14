package com.example.fixflow.repository;
import com.example.fixflow.domain.ReportRating;
import com.example.fixflow.domain.ReportStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
public interface ReportRatingRepository extends JpaRepository<ReportRating,Long> {
 boolean existsByResolution_IdAndRatedBy_Id(Long resolutionId,Long userId);
 List<ReportRating> findByResolution_Report_IdOrderByIdAsc(Long reportId);
 @Query("select avg(r.score) from ReportRating r where r.resolution.technician.id = :id and r.resolution.report.status = :status")
 Double averageConfirmedScore(@Param("id") Long technicianId, @Param("status") ReportStatus status);

 /** Reporter scores for confirmed jobs in a category, oldest first. */
 @Query("""
   select r.score from ReportRating r
   where r.resolution.technician.id = :technicianId
     and lower(r.resolution.report.category) = lower(:category)
     and r.resolution.report.status = com.example.fixflow.domain.ReportStatus.confirmed
     and r.ratedBy.role = com.example.fixflow.domain.UserRole.reporter
   order by r.id asc
   """)
 List<Integer> findConfirmedReporterScoresForCategory(
     @Param("technicianId") Long technicianId,
     @Param("category") String category);
}
