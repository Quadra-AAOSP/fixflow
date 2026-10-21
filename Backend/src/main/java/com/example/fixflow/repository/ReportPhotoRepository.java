package com.example.fixflow.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.fixflow.domain.ReportPhoto;

public interface ReportPhotoRepository extends JpaRepository<ReportPhoto, Long> {

	List<ReportPhoto> findByReportIdOrderBySortOrderAscCreatedAtAsc(Long reportId);

	Optional<ReportPhoto> findByIdAndReportId(Long photoId, Long reportId);

	long countByReportId(Long reportId);
}
