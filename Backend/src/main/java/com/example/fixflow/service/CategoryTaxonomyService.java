package com.example.fixflow.service;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.fixflow.domain.SiteType;
import com.example.fixflow.repository.SiteRuleRepository;
import com.example.fixflow.web.ApiException;

@Service
public class CategoryTaxonomyService {

	private final SiteRuleRepository siteRuleRepository;

	public CategoryTaxonomyService(SiteRuleRepository siteRuleRepository) {
		this.siteRuleRepository = siteRuleRepository;
	}

	@Transactional(readOnly = true)
	public String requireAllowedCategory(SiteType siteType, String category) {
		if (category == null || category.isBlank()) {
			throw new ApiException(HttpStatus.BAD_REQUEST.value(), "Category is required");
		}
		String normalized = category.trim().toLowerCase();
		if (!siteRuleRepository.existsBySiteTypeAndCategory(siteType, normalized)) {
			throw new ApiException(
					HttpStatus.BAD_REQUEST.value(),
					"Category '" + normalized + "' is not in the taxonomy for site type " + siteType
			);
		}
		return normalized;
	}
}
