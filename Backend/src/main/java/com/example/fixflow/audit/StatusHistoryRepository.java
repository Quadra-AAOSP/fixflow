package com.example.fixflow.audit;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface StatusHistoryRepository extends JpaRepository<StatusHistory, Long> {

	List<StatusHistory> findByReport_IdOrderByCreatedAtAsc(Long reportId);

	long countByReport_Id(Long reportId);
}
