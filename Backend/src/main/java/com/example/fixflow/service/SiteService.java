package com.example.fixflow.service;

import java.util.LinkedHashMap;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.fixflow.domain.Site;
import com.example.fixflow.domain.UserRole;
import com.example.fixflow.dto.SiteRequest;
import com.example.fixflow.dto.SiteResponse;
import com.example.fixflow.dto.SiteRuleResponse;
import com.example.fixflow.repository.SiteRepository;
import com.example.fixflow.repository.TechnicianContractRepository;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.web.ApiException;

@Service
public class SiteService {

	private final SiteRepository siteRepository;
	private final SiteRuleService siteRuleService;
	private final TechnicianContractRepository contracts;

	public SiteService(SiteRepository siteRepository, SiteRuleService siteRuleService,
			TechnicianContractRepository contracts) {
		this.siteRepository = siteRepository;
		this.siteRuleService = siteRuleService;
		this.contracts = contracts;
	}

	@Transactional(readOnly = true)
	public List<SiteResponse> list(AppUserDetails actor) {
		if (actor.getRole() == UserRole.super_admin) {
			return siteRepository.findAll().stream().map(SiteResponse::from).toList();
		}
		// Technicians are not account-scoped to one site; expose contracted sites
		// so the web workspace / reports queue can load site-scoped pages.
		if (actor.getRole() == UserRole.technician) {
			var unique = new LinkedHashMap<Long, SiteResponse>();
			for (var contract : contracts.findByTechnicianIdsWithSite(List.of(actor.getId()))) {
				Site site = contract.getSite();
				unique.putIfAbsent(site.getId(), SiteResponse.from(site));
			}
			return List.copyOf(unique.values());
		}
		if (actor.getSiteId() == null) {
			return List.of();
		}
		return siteRepository.findById(actor.getSiteId())
				.map(site -> List.of(SiteResponse.from(site)))
				.orElse(List.of());
	}

	@Transactional(readOnly = true)
	public SiteResponse get(Long id, AppUserDetails actor) {
		Site site = siteRepository.findById(id)
				.orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND.value(), "Site not found"));
		assertCanView(actor, site);
		return SiteResponse.from(site);
	}

	@Transactional(readOnly = true)
	public List<SiteRuleResponse> taxonomy(Long siteId, AppUserDetails actor) {
		Site site = siteRepository.findById(siteId)
				.orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND.value(), "Site not found"));
		// Categories are public metadata: anyone filing a report needs them,
		// including at a site other than their account site.
		return siteRuleService.listByType(site.getType());
	}

	@Transactional
	public SiteResponse create(SiteRequest request, AppUserDetails actor) {
		assertSuperAdmin(actor);
		Site site = new Site();
		apply(site, request);
		return SiteResponse.from(siteRepository.save(site));
	}

	@Transactional
	public SiteResponse update(Long id, SiteRequest request, AppUserDetails actor) {
		Site site = siteRepository.findById(id)
				.orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND.value(), "Site not found"));
		assertCanManage(actor, site);
		apply(site, request);
		return SiteResponse.from(siteRepository.save(site));
	}

	@Transactional
	public void delete(Long id, AppUserDetails actor) {
		assertSuperAdmin(actor);
		if (!siteRepository.existsById(id)) {
			throw new ApiException(HttpStatus.NOT_FOUND.value(), "Site not found");
		}
		siteRepository.deleteById(id);
	}

	private void apply(Site site, SiteRequest request) {
		site.setName(request.name().trim());
		site.setType(request.type());
		site.setContractStatus(request.contractStatus());
		site.setAddress(request.address());
		site.setDescription(request.description());
		site.setImageUrl(request.imageUrl());
		site.setContractFlatFeeMinor(request.contractFlatFeeMinor());
		String currency = request.contractFeeCurrency();
		site.setContractFeeCurrency(
				currency == null || currency.isBlank() ? "USD" : currency.trim().toUpperCase()
		);
		site.setTermsText(blankToNull(request.termsText()));
		site.setContractTermsText(blankToNull(request.contractTermsText()));
	}

	private static String blankToNull(String value) {
		if (value == null) return null;
		String trimmed = value.trim();
		return trimmed.isEmpty() ? null : trimmed;
	}

	private void assertCanView(AppUserDetails actor, Site site) {
		if (actor.getRole() == UserRole.super_admin) {
			return;
		}
		if (actor.getSiteId() != null && actor.getSiteId().equals(site.getId())) {
			return;
		}
		// Contracted technicians may list these sites for workspace/report pages and
		// must also be able to authorize the matching realtime site subscription.
		if (actor.getRole() == UserRole.technician
				&& contracts.existsByTechnician_IdAndSite_Id(actor.getId(), site.getId())) {
			return;
		}
		throw new ApiException(HttpStatus.FORBIDDEN.value(), "Not allowed to view this site");
	}

	private void assertCanManage(AppUserDetails actor, Site site) {
		if (actor.getRole() == UserRole.super_admin) {
			return;
		}
		if (actor.getRole() == UserRole.admin
				&& actor.getSiteId() != null
				&& actor.getSiteId().equals(site.getId())) {
			return;
		}
		throw new ApiException(HttpStatus.FORBIDDEN.value(), "Not allowed to manage this site");
	}

	private void assertSuperAdmin(AppUserDetails actor) {
		if (actor.getRole() != UserRole.super_admin) {
			throw new ApiException(HttpStatus.FORBIDDEN.value(), "Only super_admin can perform this action");
		}
	}
}
