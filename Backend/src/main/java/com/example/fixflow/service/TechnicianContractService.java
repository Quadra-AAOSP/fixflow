package com.example.fixflow.service;

import java.util.List;

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
	private final TechnicianTermsService terms;

	public TechnicianContractService(
			TechnicianContractRepository technicianContractRepository,
			UserRepository userRepository,
			SiteRepository siteRepository,
			RoleIntegrityService roleIntegrityService,
			TechnicianTermsService terms
	) {
		this.technicianContractRepository = technicianContractRepository;
		this.userRepository = userRepository;
		this.siteRepository = siteRepository;
		this.roleIntegrityService = roleIntegrityService;
		this.terms = terms;
	}

	@Transactional(readOnly = true)
	public List<TechnicianContractResponse> list(Long siteId, AppUserDetails actor) {
		Long scopedSiteId = resolveSiteForAdmin(actor, siteId);
		return technicianContractRepository.findDetailedBySiteId(scopedSiteId).stream()
				.map(TechnicianContractResponse::from)
				.toList();
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
		if (actor.getRole() == UserRole.admin && !site.getId().equals(actor.getSiteId())) {
			throw new ApiException(403, "Site admins can only create contracts for their own site");
		}
		if (technicianContractRepository.existsByTechnician_IdAndSite_Id(technician.getId(), site.getId())) {
			throw new ApiException(HttpStatus.CONFLICT.value(), "Contract already exists");
		}
		TechnicianContract contract = new TechnicianContract();
		terms.requireAcceptance(technician.getId());
		contract.setTechnician(technician);
		contract.setSite(site);
		return TechnicianContractResponse.from(technicianContractRepository.save(contract));
	}

	@Transactional
	public void delete(Long id, AppUserDetails actor) {
		if (actor.getRole() != UserRole.admin && actor.getRole() != UserRole.super_admin) {
			throw new ApiException(HttpStatus.FORBIDDEN.value(), "Only admin or super_admin can delete contracts");
		}
		TechnicianContract contract = technicianContractRepository.findDetailedById(id)
				.orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND.value(), "Contract not found"));
		if (actor.getRole() == UserRole.admin
				&& (actor.getSiteId() == null || !actor.getSiteId().equals(contract.getSite().getId()))) {
			throw new ApiException(403, "Site admins can only delete contracts for their own site");
		}
		technicianContractRepository.delete(contract);
	}

	private Long resolveSiteForAdmin(AppUserDetails actor, Long siteId) {
		if (actor.getRole() == UserRole.super_admin) {
			if (siteId == null) {
				throw new ApiException(400, "siteId is required");
			}
			return siteId;
		}
		if (actor.getRole() != UserRole.admin) {
			throw new ApiException(403, "Only admin or super_admin can list contracts");
		}
		if (actor.getSiteId() == null) {
			throw new ApiException(403, "Account is not scoped to a site");
		}
		if (siteId != null && !siteId.equals(actor.getSiteId())) {
			throw new ApiException(403, "Cannot list contracts for another site");
		}
		return actor.getSiteId();
	}
}
