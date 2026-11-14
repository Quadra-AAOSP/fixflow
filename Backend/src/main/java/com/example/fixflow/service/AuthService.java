package com.example.fixflow.service;

import java.util.List;

import org.springframework.data.domain.Sort;
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

import java.util.Locale;

import com.example.fixflow.domain.Site;
import com.example.fixflow.domain.TechnicianContractApplication;
import com.example.fixflow.domain.TechnicianSkill;
import com.example.fixflow.domain.TechnicianVerification;
import com.example.fixflow.audit.TechnicianVerificationAudit;
import com.example.fixflow.domain.User;
import com.example.fixflow.domain.UserRole;
import com.example.fixflow.dto.JoinableSiteResponse;
import com.example.fixflow.dto.LoginRequest;
import com.example.fixflow.dto.ProvisionUserRequest;
import com.example.fixflow.dto.RegisterRequest;
import com.example.fixflow.dto.RegisterSkillRequest;
import com.example.fixflow.dto.UserResponse;
import com.example.fixflow.repository.SiteRepository;
import com.example.fixflow.repository.TechnicianContractApplicationRepository;
import com.example.fixflow.repository.TechnicianSkillRepository;
import com.example.fixflow.audit.TechnicianVerificationAuditRepository;
import com.example.fixflow.repository.TechnicianVerificationRepository;
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
	private final com.example.fixflow.repository.SubsiteRepository subsites;
	private final SiteAdminApplicationService adminApplications;
	private final TechnicianTermsService technicianTerms;
	private final TechnicianVerificationRepository verifications;
	private final TechnicianVerificationAuditRepository verificationAudits;
	private final TechnicianContractApplicationRepository contractApplications;
	private final TechnicianSkillRepository skills;
	private final org.springframework.context.ApplicationEventPublisher events;

	public AuthService(
			UserRepository userRepository,
			SiteRepository siteRepository,
			PasswordEncoder passwordEncoder,
			AuthenticationManager authenticationManager,
			com.example.fixflow.repository.SubsiteRepository subsites,
			SiteAdminApplicationService adminApplications,
			TechnicianTermsService technicianTerms,
			TechnicianVerificationRepository verifications,
			TechnicianVerificationAuditRepository verificationAudits,
			TechnicianContractApplicationRepository contractApplications,
			TechnicianSkillRepository skills,
			org.springframework.context.ApplicationEventPublisher events
	) {
		this.userRepository = userRepository;
		this.siteRepository = siteRepository;
		this.passwordEncoder = passwordEncoder;
		this.authenticationManager = authenticationManager;
		this.subsites = subsites;
		this.adminApplications = adminApplications;
		this.technicianTerms = technicianTerms;
		this.verifications = verifications;
		this.verificationAudits = verificationAudits;
		this.contractApplications = contractApplications;
		this.skills = skills;
		this.events = events;
	}

	@Transactional
	public UserResponse register(RegisterRequest request) {
		AccountPolicy.validateRegistration(request);
		if (request.role() != UserRole.reporter && request.role() != UserRole.technician) {
			throw new ApiException(HttpStatus.BAD_REQUEST.value(),
					"Self-registration is only allowed for reporters or technicians; request a site for administrator access");
		}

		// ── Admin self-apply: bundle site creation with the application ──────
		// The applicant fills out site details (name, type, address) during
		// registration. We persist the site immediately, link it to the new
		// reporter account, and file the admin application. On approval the
		// reporter flips to admin and the applicant takes ownership of the
		// site they described — no need for super_admin to pre-create sites.
		Site autoCreatedSite = null;
		Long effectiveSiteId = request.siteId();
		if (request.role() == UserRole.admin) {
			boolean hasSiteBundle = request.siteName() != null && !request.siteName().isBlank()
					&& request.siteType() != null;
			if (hasSiteBundle && request.siteId() != null) {
				throw new ApiException(HttpStatus.BAD_REQUEST.value(),
						"Provide either siteId (join existing site) OR siteName+siteType (create new site), not both");
			}
			if (hasSiteBundle) {
				Site site = new Site();
				site.setName(request.siteName().trim());
				site.setType(request.siteType());
				site.setAddress(request.siteAddress());
				site.setDescription(request.siteDescription());
				autoCreatedSite = siteRepository.save(site);
				effectiveSiteId = autoCreatedSite.getId();
			} else if (request.siteId() == null) {
				throw new ApiException(HttpStatus.BAD_REQUEST.value(),
						"Admin self-applications must include site details (name + type) or an existing siteId");
			}
		}

		User registered = createUser(
				request.email(),
				request.password(),
				request.firstName(),
				request.lastName(),
				request.phone(),
				request.address(),
				request.role() == UserRole.admin ? UserRole.reporter : request.role(),
				effectiveSiteId
		);
		if (request.role() == UserRole.admin) adminApplications.submit(registered);
		if (request.role() == UserRole.technician) {
			completeTechnicianRegistration(registered, request);
		}
		return response(registered);
	}

	/**
	 * Public list for the registration site picker. Reporters are scoped to a
	 * site from the moment they sign up, so the choice has to be exposed
	 * before any session exists.
	 */
	@Transactional(readOnly = true)
	public List<JoinableSiteResponse> joinableSites() {
		return siteRepository.findAll(Sort.by(Sort.Direction.ASC, "name")).stream()
				.map(JoinableSiteResponse::from)
				.toList();
	}

	@Transactional
	public UserResponse provision(ProvisionUserRequest request, AppUserDetails actor) {
		if (actor == null || (actor.getRole() != UserRole.admin && actor.getRole() != UserRole.super_admin)) {
			throw new ApiException(403, "Administrator access required");
		}
		if (request.role() != UserRole.staff && request.role() != UserRole.admin
				&& request.role() != UserRole.super_admin && request.role() != UserRole.shop_manager) {
			throw new ApiException(HttpStatus.BAD_REQUEST.value(),
					"Provisioning is only for staff, admin, shop_manager or super_admin roles");
		}
		if (request.role() == UserRole.super_admin && actor.getRole() != UserRole.super_admin) {
			throw new ApiException(HttpStatus.FORBIDDEN.value(), "Only super_admin can provision another super_admin");
		}
		if (actor.getRole() == UserRole.admin) {
			if (request.role() != UserRole.staff) {
				throw new ApiException(HttpStatus.FORBIDDEN.value(), "Site admins can only provision staff");
			}
			if (request.siteId() == null || !request.siteId().equals(actor.getSiteId())) {
				throw new ApiException(HttpStatus.FORBIDDEN.value(), "Site admins can only provision users for their own site");
			}
		}
		return response(createUser(
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
		String previousSessionId = session.getId();
		httpRequest.changeSessionId();
		events.publishEvent(new com.example.fixflow.security.SessionEnded(previousSessionId));
		session.setAttribute(com.example.fixflow.security.SessionExpiryFilter.AUTHENTICATED_AT, java.time.Instant.now());
		session.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, context);

		AppUserDetails principal = (AppUserDetails) authentication.getPrincipal();
		User user = userRepository.findById(principal.getId())
				.orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED.value(), "User not found"));
		return response(user);
	}

	public void logout(HttpServletRequest request, HttpServletResponse response) {
		SecurityContextHolder.clearContext();
		HttpSession session = request.getSession(false);
		if (session != null) {
			String sessionId = session.getId();
			session.invalidate();
			events.publishEvent(new com.example.fixflow.security.SessionEnded(sessionId));
		}
	}

	@Transactional(readOnly = true)
	public UserResponse me(AppUserDetails principal) {
		User user = userRepository.findById(principal.getId())
				.orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED.value(), "User not found"));
		return response(user);
	}

	private void completeTechnicianRegistration(User technician, RegisterRequest request) {
		TechnicianVerification verification = new TechnicianVerification();
		verification.setTechnicianId(technician.getId());
		verification.setEmail(request.email().trim().toLowerCase(Locale.ROOT));
		verification.setPhone(request.phone().trim());
		verification.setTrades(request.trades().trim());
		verification.setExperience(request.experience().trim());
		verification.setQualifications(request.qualifications().trim());
		verification.setStatus("pending");
		verification.setIdentityChecked(false);
		verification.setEmailChecked(false);
		verification.setPhoneChecked(false);
		verification.setTradeChecked(false);
		verifications.saveAndFlush(verification);

		TechnicianVerificationAudit audit = new TechnicianVerificationAudit();
		audit.setTechnicianId(technician.getId());
		audit.setActorId(technician.getId());
		audit.setStatus(verification.getStatus());
		try {
			audit.setSnapshot(new com.fasterxml.jackson.databind.ObjectMapper()
					.findAndRegisterModules().writeValueAsString(verification));
		} catch (Exception ex) {
			throw new IllegalStateException("Could not record verification audit", ex);
		}
		verificationAudits.save(audit);

		technicianTerms.recordAcceptance(technician, request.technicianTermsVersion().trim());

		for (RegisterSkillRequest input : request.skills()) {
			TechnicianSkill skill = new TechnicianSkill();
			skill.setTechnician(technician);
			skill.setCategory(input.category().trim().toLowerCase(Locale.ROOT));
			skill.setSpecialty(input.specialty() == null || input.specialty().isBlank()
					? null
					: input.specialty().trim().toLowerCase(Locale.ROOT));
			skill.setProficiency(TechnicianSkill.STARTING_PROFICIENCY);
			skills.save(skill);
		}
		skills.flush();

		if (request.contractSiteId() != null) {
			Site contractSite = siteRepository.findById(request.contractSiteId())
					.orElseThrow(() -> new ApiException(404, "Contract site not found"));
			TechnicianContractApplication application = new TechnicianContractApplication();
			application.setTechnician(technician);
			application.setSite(contractSite);
			application.setNote(request.contractNote() == null || request.contractNote().isBlank()
					? null : request.contractNote().trim());
			contractApplications.saveAndFlush(application);
		}
	}

	private UserResponse response(User user) {
		var application = adminApplications.mine(new AppUserDetails(user));
		var applicationStatus = application == null ? null
				: new UserResponse.AdminApplication(application.id(), application.status().name());
		if (user.getSite() == null) {
			return UserResponse.from(user, null, applicationStatus);
		}
		Long siteId = user.getSite().getId();
		boolean ready = subsites.existsBySite_IdAndArchivedAtIsNull(siteId);
		boolean manager = user.getRole() == UserRole.admin || user.getRole() == UserRole.super_admin;
		return UserResponse.from(user, new UserResponse.SiteOnboarding(siteId, ready,
				manager && !ready, manager, "/api/sites/" + siteId + "/subsites"), applicationStatus);
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
		AccountPolicy.validatePassword(password);
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
			case reporter -> {
				// Reporters pick the site per report, so a site at sign-up is
				// optional (it only seeds their default).
				if (siteId == null) {
					yield null;
				}
				yield siteRepository.findById(siteId)
						.orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST.value(), "Site not found: " + siteId));
			}
			case staff, admin -> {
				if (siteId == null) {
					throw new ApiException(HttpStatus.BAD_REQUEST.value(), role + " accounts require a siteId");
				}
				yield siteRepository.findById(siteId)
						.orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST.value(), "Site not found: " + siteId));
			}
			case super_admin, shop_manager -> {
				if (siteId != null) {
					throw new ApiException(HttpStatus.BAD_REQUEST.value(), role + " must not have a siteId");
				}
				yield null;
			}
			case technician -> {
				if (siteId != null) {
					throw new ApiException(400, "Technicians start without a site; request a contract instead");
				}
				yield null;
			}
		};
	}
}
