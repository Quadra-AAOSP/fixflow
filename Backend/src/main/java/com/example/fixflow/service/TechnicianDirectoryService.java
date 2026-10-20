package com.example.fixflow.service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.fixflow.domain.AvailabilityStatus;
import com.example.fixflow.domain.TechnicianAvailability;
import com.example.fixflow.domain.TechnicianContract;
import com.example.fixflow.domain.TechnicianSkill;
import com.example.fixflow.domain.User;
import com.example.fixflow.domain.UserRole;
import com.example.fixflow.dto.TechnicianSummaryResponse;
import com.example.fixflow.repository.TechnicianAvailabilityRepository;
import com.example.fixflow.repository.TechnicianContractRepository;
import com.example.fixflow.repository.TechnicianSkillRepository;
import com.example.fixflow.repository.UserRepository;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.web.ApiException;

@Service
public class TechnicianDirectoryService {

	private final UserRepository userRepository;
	private final TechnicianSkillRepository technicianSkillRepository;
	private final TechnicianContractRepository technicianContractRepository;
	private final TechnicianAvailabilityRepository technicianAvailabilityRepository;

	public TechnicianDirectoryService(
			UserRepository userRepository,
			TechnicianSkillRepository technicianSkillRepository,
			TechnicianContractRepository technicianContractRepository,
			TechnicianAvailabilityRepository technicianAvailabilityRepository
	) {
		this.userRepository = userRepository;
		this.technicianSkillRepository = technicianSkillRepository;
		this.technicianContractRepository = technicianContractRepository;
		this.technicianAvailabilityRepository = technicianAvailabilityRepository;
	}

	@Transactional(readOnly = true)
	public List<TechnicianSummaryResponse> list(AppUserDetails actor) {
		if (actor == null
				|| (actor.getRole() != UserRole.staff
						&& actor.getRole() != UserRole.admin
						&& actor.getRole() != UserRole.super_admin)) {
			throw new ApiException(403, "Technician directory access required");
		}

		List<User> technicians = userRepository.findByRoleOrderByLastNameAscFirstNameAsc(UserRole.technician);
		if (technicians.isEmpty()) {
			return List.of();
		}
		List<Long> technicianIds = technicians.stream().map(User::getId).toList();

		Map<Long, List<TechnicianSkill>> skillsByTechnician = technicianSkillRepository
				.findByTechnician_IdInOrderByIdAsc(technicianIds).stream()
				.collect(Collectors.groupingBy(
						skill -> skill.getTechnician().getId(),
						LinkedHashMap::new,
						Collectors.toList()));

		Map<Long, List<TechnicianContract>> contractsByTechnician = technicianContractRepository
				.findByTechnicianIdsWithSite(technicianIds).stream()
				.collect(Collectors.groupingBy(
						contract -> contract.getTechnician().getId(),
						LinkedHashMap::new,
						Collectors.toList()));

		Map<Long, AvailabilityStatus> availabilityByTechnician = technicianAvailabilityRepository
				.findAllById(technicianIds).stream()
				.collect(Collectors.toMap(
						TechnicianAvailability::getTechnicianId,
						TechnicianAvailability::getStatus));

		return technicians.stream()
				.map(technician -> response(
						technician,
						skillsByTechnician.getOrDefault(technician.getId(), List.of()),
						contractsByTechnician.getOrDefault(technician.getId(), List.of()),
						availabilityByTechnician.getOrDefault(technician.getId(), AvailabilityStatus.unavailable)))
				.toList();
	}

	private TechnicianSummaryResponse response(
			User technician,
			List<TechnicianSkill> skills,
			List<TechnicianContract> contracts,
			AvailabilityStatus availability
	) {
		return new TechnicianSummaryResponse(
				technician.getId(),
				technician.getFirstName(),
				technician.getLastName(),
				technician.getEmail(),
				technician.getPhone(),
				availability.name(),
				skills.stream()
						.map(skill -> new TechnicianSummaryResponse.Skill(
								skill.getId(),
								skill.getCategory(),
								skill.getSpecialty(),
								skill.getProficiency()))
						.toList(),
				contracts.stream()
						.map(contract -> new TechnicianSummaryResponse.Contract(
								contract.getSite().getId(),
								contract.getSite().getName(),
								contract.getCreatedAt()))
						.toList());
	}
}
