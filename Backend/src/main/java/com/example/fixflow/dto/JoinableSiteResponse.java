package com.example.fixflow.dto;

import com.example.fixflow.domain.Site;
import com.example.fixflow.domain.SiteType;

/**
 * Minimal, non-sensitive site descriptor for the public registration picker.
 * Deliberately excludes contract status, address and timestamps.
 */
public record JoinableSiteResponse(Long id, String name, SiteType type) {

	public static JoinableSiteResponse from(Site site) {
		return new JoinableSiteResponse(site.getId(), site.getName(), site.getType());
	}
}
