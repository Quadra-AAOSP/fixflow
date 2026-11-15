package com.example.fixflow.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ProfileUpdateRequest(
        @NotBlank @Size(max = 128) String firstName,
        @NotBlank @Size(max = 128) String lastName,
        @Size(max = 64) String phone,
        @Size(max = 512) String address
) {
}