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
		Long siteId
) {
	public static UserResponse from(User user) {
		return new UserResponse(
				user.getId(),
				user.getEmail(),
				user.getFirstName(),
				user.getLastName(),
				user.getPhone(),
				user.getAddress(),
				user.getRole(),
				user.getSite() != null ? user.getSite().getId() : null
		);
	}
}
