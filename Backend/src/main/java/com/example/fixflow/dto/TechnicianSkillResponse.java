package com.example.fixflow.dto;

import com.example.fixflow.domain.TechnicianSkill;

public record TechnicianSkillResponse(
		Long id,
		Long technicianId,
		String category,
		String specialty,
		int proficiency
) {
	public static TechnicianSkillResponse from(TechnicianSkill skill) {
		return new TechnicianSkillResponse(
				skill.getId(),
				skill.getTechnician().getId(),
				skill.getCategory(),
				skill.getSpecialty(),
				skill.getProficiency()
		);
	}
}
