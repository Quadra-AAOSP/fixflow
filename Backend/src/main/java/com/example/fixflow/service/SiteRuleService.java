package com.example.fixflow.service;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.fixflow.domain.SiteRule;
import com.example.fixflow.domain.SiteType;
import com.example.fixflow.domain.UserRole;
import com.example.fixflow.dto.SiteRuleRequest;
import com.example.fixflow.dto.SiteRuleResponse;
import com.example.fixflow.repository.SiteRuleRepository;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.web.ApiException;

@Service
public class SiteRuleService {

	private final SiteRuleRepository siteRuleRepository;

	public SiteRuleService(SiteRuleRepository siteRuleRepository) {
		this.siteRuleRepository = siteRuleRepository;
	}

	@Transactional(readOnly = true)
	public List<SiteRuleResponse> listByType(SiteType siteType) {
		return siteRuleRepository.findBySiteTypeOrderBySortOrderAsc(siteType).stream()
				.map(SiteRuleResponse::from)
				.toList();
	}

	@Transactional(readOnly = true)
	public List<SiteRuleResponse> listAll() {
		return siteRuleRepository.findAll().stream().map(SiteRuleResponse::from).toList();
	}

	@Transactional
	public SiteRuleResponse create(SiteRuleRequest request, AppUserDetails actor) {
		assertCanManageRules(actor);
		if (siteRuleRepository.existsBySiteTypeAndCategory(request.siteType(), request.category())) {
			throw new ApiException(HttpStatus.CONFLICT.value(), "Category already exists for site type");
		}
		SiteRule rule = new SiteRule();
		apply(rule, request);
		return SiteRuleResponse.from(siteRuleRepository.save(rule));
	}

	@Transactional
	public SiteRuleResponse update(Long id, SiteRuleRequest request, AppUserDetails actor) {
		assertCanManageRules(actor);
		SiteRule rule = siteRuleRepository.findById(id)
				.orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND.value(), "Site rule not found"));
		siteRuleRepository.findBySiteTypeAndCategory(request.siteType(), request.category())
				.filter(existing -> !existing.getId().equals(id))
				.ifPresent(existing -> {
					throw new ApiException(HttpStatus.CONFLICT.value(), "Category already exists for site type");
				});
		apply(rule, request);
		return SiteRuleResponse.from(siteRuleRepository.save(rule));
	}

	@Transactional
	public void delete(Long id, AppUserDetails actor) {
		assertCanManageRules(actor);
		if (!siteRuleRepository.existsById(id)) {
			throw new ApiException(HttpStatus.NOT_FOUND.value(), "Site rule not found");
		}
		siteRuleRepository.deleteById(id);
	}

	private void apply(SiteRule rule, SiteRuleRequest request) {
		rule.setSiteType(request.siteType());
		rule.setCategory(request.category().trim().toLowerCase());
		rule.setUrgencyWeight(request.urgencyWeight());
		rule.setSortOrder(request.sortOrder());
	}

	private void assertCanManageRules(AppUserDetails actor) {
		if (actor.getRole() != UserRole.admin && actor.getRole() != UserRole.super_admin) {
			throw new ApiException(HttpStatus.FORBIDDEN.value(), "Only admin or super_admin can manage site rules");
		}
	}
}
