package com.example.fixflow.web;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.fixflow.dto.ProvisionUserRequest;
import com.example.fixflow.dto.UserResponse;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.service.AuthService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/admin/users")
public class AdminUserController {

	private final AuthService authService;

	public AdminUserController(AuthService authService) {
		this.authService = authService;
	}

	@PostMapping
	public ResponseEntity<UserResponse> provision(
			@Valid @RequestBody ProvisionUserRequest request,
			@AuthenticationPrincipal AppUserDetails principal
	) {
		return ResponseEntity.status(HttpStatus.CREATED).body(authService.provision(request, principal));
	}
}
