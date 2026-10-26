package com.example.fixflow.web;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.fixflow.dto.LoginRequest;
import com.example.fixflow.dto.RegisterRequest;
import com.example.fixflow.dto.UserResponse;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.service.AuthService;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

	private final AuthService authService;
    private final org.springframework.security.web.csrf.CsrfTokenRepository csrfTokens;

	public AuthController(AuthService authService,
            org.springframework.security.web.csrf.CsrfTokenRepository csrfTokens) {
		this.authService = authService;
        this.csrfTokens = csrfTokens;
	}

    @GetMapping("/csrf")
    public java.util.Map<String, String> csrf(org.springframework.security.web.csrf.CsrfToken token,
            HttpServletResponse response) {
        response.setHeader("Cache-Control", "no-store");
        return java.util.Map.of("headerName", token.getHeaderName(), "token", token.getToken());
    }

	@PostMapping("/register")
	public ResponseEntity<UserResponse> register(@Valid @RequestBody RegisterRequest request) {
		return ResponseEntity.status(HttpStatus.CREATED).body(authService.register(request));
	}

    @GetMapping("/policy")
    public java.util.Map<String, Object> policy() {
        return java.util.Map.of(
                "passwordMinLength", com.example.fixflow.service.AccountPolicy.PASSWORD_MIN_LENGTH,
                "selfRegistrationRoles", java.util.List.of("reporter", "technician", "admin"),
                "siteAdminApprovalRequired", true,
                "siteAdminApplicationStatusEndpoint", "/api/auth/site-admin-application",
                "managedRoleMessage", "Site admin applicants start as reporters until super-admin approval. "
                        + "Identity checks, independent approval and MFA are policy requirements, "
                        + "not currently automated checks in this application.");
    }

	@PostMapping("/login")
	public UserResponse login(@Valid @RequestBody LoginRequest request, HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) {
        UserResponse user = authService.login(request, httpRequest);
        // This controller authenticates manually, so rotate the token explicitly too.
        csrfTokens.saveToken(null, httpRequest, httpResponse);
        return user;
	}

	@PostMapping("/logout")
	public ResponseEntity<Void> logout(HttpServletRequest request, HttpServletResponse response) {
		authService.logout(request, response);
		return ResponseEntity.noContent().build();
	}

	@GetMapping("/me")
	public UserResponse me(@AuthenticationPrincipal AppUserDetails principal) {
		return authService.me(principal);
	}
}
