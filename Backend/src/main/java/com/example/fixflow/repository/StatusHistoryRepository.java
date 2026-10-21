package com.example.fixflow.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.fixflow.domain.StatusHistory;

public interface StatusHistoryRepository extends JpaRepository<StatusHistory, Long> {

	List<StatusHistory> findByReport_IdOrderByCreatedAtAsc(Long reportId);

	long countByReport_Id(Long reportId);
}
