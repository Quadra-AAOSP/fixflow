package com.example.fixflow.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ChangePasswordRequest(
		@NotBlank @Size(max = 100) String currentPassword,
		@NotBlank @Size(min = 15, max = 100) String newPassword) {
}
