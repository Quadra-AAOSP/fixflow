package com.example.fixflow.service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.fixflow.domain.AvailabilityStatus;
import com.example.fixflow.domain.ContractStatus;
import com.example.fixflow.domain.Site;
import com.example.fixflow.domain.TechnicianAvailability;
import com.example.fixflow.domain.TechnicianContract;
import com.example.fixflow.domain.User;
import com.example.fixflow.domain.UserRole;
import com.example.fixflow.dto.TechnicianPoolMemberResponse;
import com.example.fixflow.repository.SiteRepository;
import com.example.fixflow.repository.TechnicianAvailabilityRepository;
import com.example.fixflow.repository.TechnicianContractRepository;
import com.example.fixflow.repository.UserRepository;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.web.ApiException;

@Service
public class TechnicianPoolService {

	private final SiteRepository siteRepository;
	private final TechnicianContractRepository contractRepository;
	private final TechnicianAvailabilityRepository availabilityRepository;
	private final UserRepository userRepository;

	public TechnicianPoolService(
			SiteRepository siteRepository,
			TechnicianContractRepository contractRepository,
			TechnicianAvailabilityRepository availabilityRepository,
			UserRepository userRepository
	) {
		this.siteRepository = siteRepository;
		this.contractRepository = contractRepository;
		this.availabilityRepository = availabilityRepository;
		this.userRepository = userRepository;
	}

	@Transactional(readOnly = true)
	public List<TechnicianPoolMemberResponse> eligiblePool(Long siteId, AppUserDetails actor) {
		assertCanViewPool(actor, siteId);
		Site site = siteRepository.findById(siteId)
				.orElseThrow(() -> new ApiException(404, "Site not found"));

		List<User> candidates;
		Set<Long> contractedIds = new HashSet<>();
		if (site.getContractStatus() == ContractStatus.contracted) {
			List<TechnicianContract> contracts = contractRepository.findDetailedBySiteId(siteId);
			candidates = new ArrayList<>();
			for (TechnicianContract contract : contracts) {
				User technician = contract.getTechnician();
				if (technician.getRole() == UserRole.technician) {
					candidates.add(technician);
					contractedIds.add(technician.getId());
				}
			}
		} else {
			candidates = userRepository.findAll().stream()
					.filter(user -> user.getRole() == UserRole.technician)
					.toList();
		}

		Map<Long, AvailabilityStatus> availabilityByTech = new HashMap<>();
		for (TechnicianAvailability row : availabilityRepository.findAll()) {
			availabilityByTech.put(row.getTechnicianId(), row.getStatus());
		}

		List<TechnicianPoolMemberResponse> pool = new ArrayList<>();
		for (User technician : candidates) {
			AvailabilityStatus status = availabilityByTech.getOrDefault(
					technician.getId(), AvailabilityStatus.unavailable);
			if (status != AvailabilityStatus.available) {
				continue;
			}
			boolean contracted = contractedIds.contains(technician.getId())
					|| contractRepository.existsByTechnician_IdAndSite_Id(technician.getId(), siteId);
			pool.add(new TechnicianPoolMemberResponse(
					technician.getId(),
					technician.getFirstName(),
					technician.getLastName(),
					technician.getEmail(),
					status,
					contracted
			));
		}
		return pool;
	}

	private void assertCanViewPool(AppUserDetails actor, Long siteId) {
		if (actor.getRole() == UserRole.super_admin) {
			return;
		}
		if ((actor.getRole() == UserRole.admin || actor.getRole() == UserRole.staff)
				&& actor.getSiteId() != null
				&& actor.getSiteId().equals(siteId)) {
			return;
		}
		throw new ApiException(403, "Only staff or admin can view the technician pool");
	}
}
