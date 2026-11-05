package com.example.fixflow.dto;

import com.example.fixflow.domain.SiteType;
import com.example.fixflow.domain.UserRole;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
		@NotBlank @Email @Size(max = 255) String email,
		@NotBlank @Size(min = 8, max = 100) String password,
		@NotBlank @Size(max = 128) String firstName,
		@NotBlank @Size(max = 128) String lastName,
		@Size(max = 64) String phone,
		@Size(max = 512) String address,
		@NotNull UserRole role,
		Long siteId,
		// Admin self-apply bundle — submit site details with the application.
		// Site is created immediately, linked to the applicant as reporter,
		// and approved together with the admin role by super_admin.
		@Size(max = 128) String siteName,
		SiteType siteType,
		@Size(max = 512) String siteAddress,
		@Size(max = 2000) String siteDescription
) {
}
