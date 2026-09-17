package com.example.fixflow.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.example.fixflow.domain.User;
import com.example.fixflow.domain.UserRole;
import com.example.fixflow.repository.UserRepository;

@Component
public class BootstrapSuperAdminRunner implements ApplicationRunner {

	private static final Logger log = LoggerFactory.getLogger(BootstrapSuperAdminRunner.class);

	private final BootstrapProperties properties;
	private final UserRepository userRepository;
	private final PasswordEncoder passwordEncoder;

	public BootstrapSuperAdminRunner(
			BootstrapProperties properties,
			UserRepository userRepository,
			PasswordEncoder passwordEncoder
	) {
		this.properties = properties;
		this.userRepository = userRepository;
		this.passwordEncoder = passwordEncoder;
	}

	@Override
	@Transactional
	public void run(ApplicationArguments args) {
		if (userRepository.existsByRole(UserRole.super_admin)) {
			return;
		}
		String email = properties.superAdminEmail();
		String password = properties.superAdminPassword();
		if (email == null || email.isBlank() || password == null || password.isBlank()) {
			log.warn("No super_admin exists and bootstrap credentials are not configured");
			return;
		}
		User admin = new User();
		admin.setEmail(email.trim().toLowerCase());
		admin.setPasswordHash(passwordEncoder.encode(password));
		admin.setFirstName("Super");
		admin.setLastName("Admin");
		admin.setRole(UserRole.super_admin);
		userRepository.save(admin);
		log.info("Bootstrapped initial super_admin account: {}", admin.getEmail());
	}
}
