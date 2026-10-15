package com.example.fixflow.service;

import java.nio.charset.StandardCharsets;
import com.example.fixflow.domain.UserRole;
import com.example.fixflow.dto.RegisterRequest;
import com.example.fixflow.web.ApiException;

/** New-account requirements. Never apply strength rules to existing-account login. */
public final class AccountPolicy {
    public static final int PASSWORD_MIN_LENGTH = 15;
    public static final int PASSWORD_MAX_LENGTH = 100;
    private AccountPolicy() { }

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
        if (request.role() == UserRole.technician) {
            if (request.phone() == null || request.phone().replaceAll("\\D", "").length() < 7) {
                throw new ApiException(400, "Enter a contact phone number for technician registration.");
            }
            if (request.address() == null || request.address().isBlank()) {
                throw new ApiException(400, "Enter your business or correspondence address.");
            }
        }
    }
}
