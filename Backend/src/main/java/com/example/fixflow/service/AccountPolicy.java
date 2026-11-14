package com.example.fixflow.service;

import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

import com.example.fixflow.domain.UserRole;
import com.example.fixflow.dto.RegisterRequest;
import com.example.fixflow.dto.RegisterSkillRequest;
import com.example.fixflow.web.ApiException;

/** New-account requirements. Never apply strength rules to existing-account login. */
public final class AccountPolicy {
	public static final int PASSWORD_MIN_LENGTH = 15;
	public static final int PASSWORD_MAX_LENGTH = 100;
	private static final Set<String> SKILL_CATEGORIES = Set.of(
			"plumbing", "electrical", "hvac", "carpentry", "cleaning", "general");

	private AccountPolicy() {
	}

	public static void validatePassword(String password) {
		if (password.codePointCount(0, password.length()) < PASSWORD_MIN_LENGTH
				|| password.length() > PASSWORD_MAX_LENGTH) {
			throw new ApiException(400, "Use a password between 15 and 100 characters.");
		}
		if (password.getBytes(StandardCharsets.UTF_8).length > 72) {
			throw new ApiException(400, "Password must not exceed 72 UTF-8 bytes.");
		}
	}

	public static void validateRegistration(RegisterRequest request) {
		if (request.role() != UserRole.technician) {
			return;
		}
		if (request.phone() == null || request.phone().replaceAll("\\D", "").length() < 7) {
			throw new ApiException(400, "Enter a contact phone number for technician registration.");
		}
		if (request.address() == null || request.address().isBlank()) {
			throw new ApiException(400, "Enter your business or correspondence address.");
		}
		if (blank(request.trades()) || blank(request.experience()) || blank(request.qualifications())) {
			throw new ApiException(400,
					"Technician registration requires trades, experience, and qualifications for verification.");
		}
		if (!Boolean.TRUE.equals(request.acceptTechnicianTerms())) {
			throw new ApiException(400, "Accept the current technician terms to create an account.");
		}
		if (blank(request.technicianTermsVersion())) {
			throw new ApiException(400, "Technician terms version is required.");
		}
		validateSkills(request.skills());
		if (request.contractSiteId() != null && request.contractSiteId() <= 0) {
			throw new ApiException(400, "Contract site id must be a positive site id when provided.");
		}
	}

	private static void validateSkills(List<RegisterSkillRequest> skills) {
		if (skills == null || skills.isEmpty()) {
			throw new ApiException(400, "Add at least one structured skill (category).");
		}
		if (skills.size() > 20) {
			throw new ApiException(400, "At most 20 skills can be registered.");
		}
		Set<String> seen = new HashSet<>();
		for (RegisterSkillRequest skill : skills) {
			if (skill == null || blank(skill.category())) {
				throw new ApiException(400, "Each skill requires a category.");
			}
			String category = skill.category().trim().toLowerCase(Locale.ROOT);
			if (!SKILL_CATEGORIES.contains(category)) {
				throw new ApiException(400, "Unknown skill category: " + category);
			}
			String specialty = skill.specialty() == null || skill.specialty().isBlank()
					? ""
					: skill.specialty().trim().toLowerCase(Locale.ROOT);
			String key = category + "\0" + specialty;
			if (!seen.add(key)) {
				throw new ApiException(400, "Duplicate skill category/specialty pairs are not allowed.");
			}
		}
	}

	private static boolean blank(String value) {
		return value == null || value.isBlank();
	}
}
