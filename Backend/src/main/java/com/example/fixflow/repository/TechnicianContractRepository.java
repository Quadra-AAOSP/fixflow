package com.example.fixflow.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.fixflow.domain.TechnicianContract;

public interface TechnicianContractRepository extends JpaRepository<TechnicianContract, Long> {

	boolean existsByTechnician_IdAndSite_Id(Long technicianId, Long siteId);
}
