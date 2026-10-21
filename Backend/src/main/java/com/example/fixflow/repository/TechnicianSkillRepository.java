package com.example.fixflow.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.fixflow.domain.TechnicianSkill;

public interface TechnicianSkillRepository extends JpaRepository<TechnicianSkill, Long> {
    org.springframework.data.domain.Page<TechnicianSkill> findByCategoryIgnoreCase(String category,
            org.springframework.data.domain.Pageable pageable);
    java.util.List<TechnicianSkill> findByTechnician_IdAndCategoryIgnoreCase(Long technicianId, String category);
}
