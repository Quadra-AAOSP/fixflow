package com.example.fixflow.service;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.fixflow.domain.Site;
import com.example.fixflow.domain.UserRole;
import com.example.fixflow.dto.SiteRequest;
import com.example.fixflow.dto.SiteResponse;
import com.example.fixflow.repository.SiteRepository;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.web.ApiException;

@Service
public class SiteService {

	private final SiteRepository siteRepository;

	public SiteService(SiteRepository siteRepository) {
		this.siteRepository = siteRepository;
	}

	@Transactional(readOnly = true)
	public List<SiteResponse> list(AppUserDetails actor) {
		if (actor.getRole() == UserRole.super_admin) {
			return siteRepository.findAll().stream().map(SiteResponse::from).toList();
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
	}

	private void assertCanView(AppUserDetails actor, Site site) {
		if (actor.getRole() == UserRole.super_admin) {
			return;
		}
		if (actor.getSiteId() != null && actor.getSiteId().equals(site.getId())) {
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
