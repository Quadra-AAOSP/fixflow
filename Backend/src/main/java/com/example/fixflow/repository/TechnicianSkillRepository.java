package com.example.fixflow.repository;

import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.fixflow.domain.TechnicianSkill;

public interface TechnicianSkillRepository extends JpaRepository<TechnicianSkill, Long> {

	List<TechnicianSkill> findByTechnician_IdInOrderByIdAsc(Collection<Long> technicianIds);
}
