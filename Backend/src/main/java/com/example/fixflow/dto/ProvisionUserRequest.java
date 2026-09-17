package com.example.fixflow.dto;

import com.example.fixflow.domain.UserRole;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ProvisionUserRequest(
		@NotBlank @Email String email,
		@NotBlank @Size(min = 8, max = 100) String password,
		@NotBlank @Size(max = 128) String firstName,
		@NotBlank @Size(max = 128) String lastName,
		@Size(max = 64) String phone,
		@Size(max = 512) String address,
		@NotNull UserRole role,
		Long siteId
) {
}
