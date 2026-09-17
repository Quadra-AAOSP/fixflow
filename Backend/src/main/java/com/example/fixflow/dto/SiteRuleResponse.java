package com.example.fixflow.dto;

import com.example.fixflow.domain.SiteRule;
import com.example.fixflow.domain.SiteType;

public record SiteRuleResponse(
		Long id,
		SiteType siteType,
		String category,
		Integer urgencyWeight,
		Integer sortOrder
) {
	public static SiteRuleResponse from(SiteRule rule) {
		return new SiteRuleResponse(
				rule.getId(),
				rule.getSiteType(),
				rule.getCategory(),
				rule.getUrgencyWeight(),
				rule.getSortOrder()
		);
	}
}
