package com.example.fixflow.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.fixflow.domain.ReportReporter;
import com.example.fixflow.domain.ReportReporterId;

public interface ReportReporterRepository extends JpaRepository<ReportReporter, ReportReporterId> {

	long countByReportId(Long reportId);

	void deleteByReportIdAndUserId(Long reportId, Long userId);

	boolean existsByReportIdAndUserId(Long reportId, Long userId);

	List<ReportReporter> findByReportIdOrderByJoinedAtAsc(Long reportId);
}
