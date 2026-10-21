package com.example.fixflow.service;

import java.time.Instant;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.fixflow.domain.AvailabilityStatus;
import com.example.fixflow.domain.TechnicianAvailability;
import com.example.fixflow.domain.User;
import com.example.fixflow.domain.UserRole;
import com.example.fixflow.dto.AvailabilityRequest;
import com.example.fixflow.dto.AvailabilityResponse;
import com.example.fixflow.repository.TechnicianAvailabilityRepository;
import com.example.fixflow.repository.UserRepository;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.web.ApiException;

@Service
public class TechnicianAvailabilityService {

	private final TechnicianAvailabilityRepository availabilityRepository;
	private final UserRepository userRepository;
	private final RoleIntegrityService roleIntegrityService;

	public TechnicianAvailabilityService(
			TechnicianAvailabilityRepository availabilityRepository,
			UserRepository userRepository,
			RoleIntegrityService roleIntegrityService
	) {
		this.availabilityRepository = availabilityRepository;
		this.userRepository = userRepository;
		this.roleIntegrityService = roleIntegrityService;
	}

	@Transactional(readOnly = true)
	public AvailabilityResponse getMine(AppUserDetails actor) {
		requireTechnician(actor);
		return availabilityRepository.findById(actor.getId())
				.map(this::toResponse)
				.orElseGet(() -> new AvailabilityResponse(actor.getId(), AvailabilityStatus.unavailable, null));
	}

	@Transactional
	public AvailabilityResponse updateMine(AvailabilityRequest request, AppUserDetails actor) {
		requireTechnician(actor);
		User technician = userRepository.findById(actor.getId())
				.orElseThrow(() -> new ApiException(401, "User not found"));
		roleIntegrityService.requireTechnician(technician);

		TechnicianAvailability availability = availabilityRepository.findById(actor.getId())
				.orElseGet(() -> {
					TechnicianAvailability created = new TechnicianAvailability();
					created.setTechnician(technician);
					return created;
				});
		availability.setStatus(request.status());
		return toResponse(availabilityRepository.save(availability));
	}

	private AvailabilityResponse toResponse(TechnicianAvailability availability) {
		Instant updatedAt = availability.getUpdatedAt();
		return new AvailabilityResponse(
				availability.getTechnicianId(),
				availability.getStatus(),
				updatedAt
		);
	}

	private void requireTechnician(AppUserDetails actor) {
		if (actor.getRole() != UserRole.technician) {
			throw new ApiException(403, "Only technicians can manage availability");
		}
	}
}
