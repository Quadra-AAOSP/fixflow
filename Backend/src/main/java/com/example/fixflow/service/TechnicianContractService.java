package com.example.fixflow.service;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.fixflow.domain.Site;
import com.example.fixflow.domain.TechnicianContract;
import com.example.fixflow.domain.User;
import com.example.fixflow.domain.UserRole;
import com.example.fixflow.dto.TechnicianContractRequest;
import com.example.fixflow.dto.TechnicianContractResponse;
import com.example.fixflow.repository.SiteRepository;
import com.example.fixflow.repository.TechnicianContractRepository;
import com.example.fixflow.repository.UserRepository;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.web.ApiException;

@Service
public class TechnicianContractService {

	private final TechnicianContractRepository technicianContractRepository;
	private final UserRepository userRepository;
	private final SiteRepository siteRepository;
	private final RoleIntegrityService roleIntegrityService;

	public TechnicianContractService(
			TechnicianContractRepository technicianContractRepository,
			UserRepository userRepository,
			SiteRepository siteRepository,
			RoleIntegrityService roleIntegrityService
	) {
		this.technicianContractRepository = technicianContractRepository;
		this.userRepository = userRepository;
		this.siteRepository = siteRepository;
		this.roleIntegrityService = roleIntegrityService;
	}

	@Transactional
	public TechnicianContractResponse create(TechnicianContractRequest request, AppUserDetails actor) {
		if (actor.getRole() != UserRole.admin && actor.getRole() != UserRole.super_admin) {
			throw new ApiException(HttpStatus.FORBIDDEN.value(), "Only admin or super_admin can create contracts");
		}
		User technician = userRepository.findById(request.technicianId())
				.orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST.value(), "User not found"));
		roleIntegrityService.requireTechnician(technician);
		Site site = siteRepository.findById(request.siteId())
				.orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST.value(), "Site not found"));
		if (technicianContractRepository.existsByTechnician_IdAndSite_Id(technician.getId(), site.getId())) {
			throw new ApiException(HttpStatus.CONFLICT.value(), "Contract already exists");
		}
		TechnicianContract contract = new TechnicianContract();
		contract.setTechnician(technician);
		contract.setSite(site);
		return TechnicianContractResponse.from(technicianContractRepository.save(contract));
	}
}
