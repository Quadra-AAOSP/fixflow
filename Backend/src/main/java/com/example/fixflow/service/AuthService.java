package com.example.fixflow.service;

import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.fixflow.domain.Site;
import com.example.fixflow.domain.User;
import com.example.fixflow.domain.UserRole;
import com.example.fixflow.dto.LoginRequest;
import com.example.fixflow.dto.ProvisionUserRequest;
import com.example.fixflow.dto.RegisterRequest;
import com.example.fixflow.dto.UserResponse;
import com.example.fixflow.repository.SiteRepository;
import com.example.fixflow.repository.UserRepository;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.web.ApiException;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

@Service
public class AuthService {

	private final UserRepository userRepository;
	private final SiteRepository siteRepository;
	private final PasswordEncoder passwordEncoder;
	private final AuthenticationManager authenticationManager;

	public AuthService(
			UserRepository userRepository,
			SiteRepository siteRepository,
			PasswordEncoder passwordEncoder,
			AuthenticationManager authenticationManager
	) {
		this.userRepository = userRepository;
		this.siteRepository = siteRepository;
		this.passwordEncoder = passwordEncoder;
		this.authenticationManager = authenticationManager;
	}

	@Transactional
	public UserResponse register(RegisterRequest request) {
		if (request.role() != UserRole.reporter && request.role() != UserRole.technician) {
			throw new ApiException(HttpStatus.BAD_REQUEST.value(),
					"Self-registration is only allowed for reporter and technician roles");
		}
		return UserResponse.from(createUser(
				request.email(),
				request.password(),
				request.firstName(),
				request.lastName(),
				request.phone(),
				request.address(),
				request.role(),
				request.siteId()
		));
	}

	@Transactional
	public UserResponse provision(ProvisionUserRequest request, AppUserDetails actor) {
		if (request.role() != UserRole.staff && request.role() != UserRole.admin && request.role() != UserRole.super_admin) {
			throw new ApiException(HttpStatus.BAD_REQUEST.value(),
					"Admin provisioning is only for staff, admin, or super_admin roles");
		}
		if (request.role() == UserRole.super_admin && actor.getRole() != UserRole.super_admin) {
			throw new ApiException(HttpStatus.FORBIDDEN.value(), "Only super_admin can provision another super_admin");
		}
		if (actor.getRole() == UserRole.admin) {
			if (request.role() == UserRole.admin || request.role() == UserRole.super_admin) {
				throw new ApiException(HttpStatus.FORBIDDEN.value(), "Site admins can only provision staff");
			}
			if (request.siteId() == null || !request.siteId().equals(actor.getSiteId())) {
				throw new ApiException(HttpStatus.FORBIDDEN.value(), "Site admins can only provision users for their own site");
			}
		}
		return UserResponse.from(createUser(
				request.email(),
				request.password(),
				request.firstName(),
				request.lastName(),
				request.phone(),
				request.address(),
				request.role(),
				request.siteId()
		));
	}

	@Transactional(readOnly = true)
	public UserResponse login(LoginRequest request, HttpServletRequest httpRequest) {
		Authentication authentication = authenticationManager.authenticate(
				new UsernamePasswordAuthenticationToken(request.email().trim().toLowerCase(), request.password())
		);
		SecurityContext context = SecurityContextHolder.createEmptyContext();
		context.setAuthentication(authentication);
		SecurityContextHolder.setContext(context);
		HttpSession session = httpRequest.getSession(true);
		session.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, context);

		AppUserDetails principal = (AppUserDetails) authentication.getPrincipal();
		User user = userRepository.findById(principal.getId())
				.orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED.value(), "User not found"));
		return UserResponse.from(user);
	}

	public void logout(HttpServletRequest request, HttpServletResponse response) {
		SecurityContextHolder.clearContext();
		HttpSession session = request.getSession(false);
		if (session != null) {
			session.invalidate();
		}
	}

	@Transactional(readOnly = true)
	public UserResponse me(AppUserDetails principal) {
		User user = userRepository.findById(principal.getId())
				.orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED.value(), "User not found"));
		return UserResponse.from(user);
	}

	private User createUser(
			String email,
			String password,
			String firstName,
			String lastName,
			String phone,
			String address,
			UserRole role,
			Long siteId
	) {
		String normalizedEmail = email.trim().toLowerCase();
		if (userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
			throw new ApiException(HttpStatus.CONFLICT.value(), "Email is already registered");
		}

		Site site = resolveSiteForRole(role, siteId);

		User user = new User();
		user.setEmail(normalizedEmail);
		user.setPasswordHash(passwordEncoder.encode(password));
		user.setFirstName(firstName.trim());
		user.setLastName(lastName.trim());
		user.setPhone(phone);
		user.setAddress(address);
		user.setRole(role);
		user.setSite(site);
		return userRepository.save(user);
	}

	private Site resolveSiteForRole(UserRole role, Long siteId) {
		return switch (role) {
			case reporter, staff, admin -> {
				if (siteId == null) {
					throw new ApiException(HttpStatus.BAD_REQUEST.value(), role + " accounts require a siteId");
				}
				yield siteRepository.findById(siteId)
						.orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST.value(), "Site not found: " + siteId));
			}
			case super_admin -> {
				if (siteId != null) {
					throw new ApiException(HttpStatus.BAD_REQUEST.value(), "super_admin must not have a siteId");
				}
				yield null;
			}
			case technician -> {
				if (siteId == null) {
					yield null;
				}
				yield siteRepository.findById(siteId)
						.orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST.value(), "Site not found: " + siteId));
			}
		};
	}
}
