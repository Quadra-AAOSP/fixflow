package com.example.fixflow.dto;

import com.example.fixflow.domain.User;
import com.example.fixflow.domain.UserRole;

public record UserResponse(
		Long id,
		String email,
		String firstName,
		String lastName,
		String phone,
		String address,
		UserRole role,
		Long siteId,
        UserCapabilities capabilities,
        SiteOnboarding siteOnboarding,
        AdminApplication adminApplication,
        boolean applicationOnly
) {
	public record AdminApplication(Long id, String status) { }
	public record SiteOnboarding(Long siteId, boolean reportingReady, boolean setupRequired,
			boolean canManageSubsites, String setupEndpoint) { }

	public static UserResponse from(User user) {
		return from(user, null, null);
	}

	public static UserResponse from(User user, SiteOnboarding onboarding, AdminApplication application) {
        boolean applicationOnly = user.getRole() == UserRole.reporter && application != null;
		return new UserResponse(
				user.getId(),
				user.getEmail(),
				user.getFirstName(),
				user.getLastName(),
				user.getPhone(),
				user.getAddress(),
				user.getRole(),
				user.getSite() != null ? user.getSite().getId() : null,
                applicationOnly ? new UserCapabilities(false, false, false, false, false, false,
                        java.util.List.of(), false) : UserCapabilities.forRole(user.getRole()),
                applicationOnly ? null : onboarding,
                application,
                applicationOnly
		);
	}
}
