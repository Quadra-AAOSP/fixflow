package com.example.fixflow.service;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.fixflow.domain.TechnicianSkill;
import com.example.fixflow.domain.User;
import com.example.fixflow.domain.UserRole;
import com.example.fixflow.dto.TechnicianSkillRequest;
import com.example.fixflow.dto.TechnicianSkillResponse;
import com.example.fixflow.repository.TechnicianSkillRepository;
import com.example.fixflow.repository.UserRepository;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.web.ApiException;

@Service
public class TechnicianSkillService {

	private final TechnicianSkillRepository technicianSkillRepository;
	private final UserRepository userRepository;
	private final RoleIntegrityService roleIntegrityService;

	public TechnicianSkillService(
			TechnicianSkillRepository technicianSkillRepository,
			UserRepository userRepository,
			RoleIntegrityService roleIntegrityService
	) {
		this.technicianSkillRepository = technicianSkillRepository;
		this.userRepository = userRepository;
		this.roleIntegrityService = roleIntegrityService;
	}

	@Transactional
	public TechnicianSkillResponse create(TechnicianSkillRequest request, AppUserDetails actor) {
		if (actor.getRole() == UserRole.technician && !actor.getId().equals(request.technicianId())) {
			throw new ApiException(HttpStatus.FORBIDDEN.value(), "Technicians can only add their own skills");
		}
		if (actor.getRole() != UserRole.technician
				&& actor.getRole() != UserRole.admin
				&& actor.getRole() != UserRole.super_admin) {
			throw new ApiException(HttpStatus.FORBIDDEN.value(), "Not allowed to add technician skills");
		}
		User technician = userRepository.findById(request.technicianId())
				.orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST.value(), "User not found"));
		roleIntegrityService.requireTechnician(technician);
		TechnicianSkill skill = new TechnicianSkill();
		skill.setTechnician(technician);
		skill.setCategory(request.category().trim().toLowerCase());
		skill.setSpecialty(request.specialty() == null || request.specialty().isBlank()
				? null
				: request.specialty().trim().toLowerCase());
		skill.setProficiency(request.proficiency() == null ? 3 : request.proficiency());
		return TechnicianSkillResponse.from(technicianSkillRepository.save(skill));
	}
}
