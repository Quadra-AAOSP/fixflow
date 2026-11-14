package com.example.fixflow.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.fixflow.domain.JobOffer;

public interface JobOfferRepository extends JpaRepository<JobOffer, Long> {
	List<JobOffer> findByReport_IdOrderByIdDesc(Long reportId);

	List<JobOffer> findByTechnician_IdOrderByIdDesc(Long technicianId);

	Optional<JobOffer> findByIdAndReport_Id(Long id, Long reportId);

	List<JobOffer> findByReport_IdAndStatusIn(Long reportId, List<JobOffer.Status> statuses);
}
