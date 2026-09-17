package com.example.fixflow.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.fixflow.domain.TechnicianAvailability;

public interface TechnicianAvailabilityRepository extends JpaRepository<TechnicianAvailability, Long> {
}
