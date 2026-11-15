package com.example.fixflow.service;

import com.example.fixflow.domain.Site;

/**
 * Site is operational only after the admin finishes the three setup steps:
 * labelled buildings, site profile (address), and both terms/contract documents
 * (uploaded files, or legacy pasted text).
 */
public final class SiteSetupPolicy {
	private SiteSetupPolicy() {
	}

	public static boolean hasProfile(Site site) {
		return site != null && notBlank(site.getAddress());
	}

	public static boolean hasTerms(Site site) {
		if (site == null) {
			return false;
		}
		boolean documents = notBlank(site.getTermsDocumentKey())
				&& notBlank(site.getContractTermsDocumentKey());
		boolean legacyText = notBlank(site.getTermsText()) && notBlank(site.getContractTermsText());
		return documents || legacyText;
	}

	public static boolean isOperational(Site site, boolean hasActiveBuilding) {
		return hasActiveBuilding && hasProfile(site) && hasTerms(site);
	}

	private static boolean notBlank(String value) {
		return value != null && !value.isBlank();
	}
}
