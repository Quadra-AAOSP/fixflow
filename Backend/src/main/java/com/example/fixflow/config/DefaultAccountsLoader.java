package com.example.fixflow.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import com.example.fixflow.domain.User;
import com.example.fixflow.domain.UserRole;
import com.example.fixflow.repository.UserRepository;

/**
 * When demo seed is off, ensures a fresh database still has one platform
 * {@code super_admin} and one {@code shop_manager} so the product can be
 * administered without loading the full demo dataset.
 *
 * <p>Passwords match the account email (same convention as demo SQL). Change
 * them after first login on non-local deployments.
 */
@Component
@ConditionalOnProperty(prefix = "fixflow.seed", name = "demo-enabled", havingValue = "false", matchIfMissing = true)
public class DefaultAccountsLoader implements ApplicationRunner {

	private static final Logger log = LoggerFactory.getLogger(DefaultAccountsLoader.class);

	public static final String SUPER_ADMIN_EMAIL = "superadmin@fixflow.test";
	public static final String SHOP_MANAGER_EMAIL = "shopmanager@fixflow.test";

	private final UserRepository users;
	private final PasswordEncoder passwords;

	public DefaultAccountsLoader(UserRepository users, PasswordEncoder passwords) {
		this.users = users;
		this.passwords = passwords;
	}

	@Override
	public void run(ApplicationArguments args) {
		ensure(UserRole.super_admin, SUPER_ADMIN_EMAIL, "Super", "Admin");
		ensure(UserRole.shop_manager, SHOP_MANAGER_EMAIL, "Shop", "Manager");
	}

	private void ensure(UserRole role, String email, String firstName, String lastName) {
		if (users.existsByRole(role)) {
			return;
		}
		if (users.existsByEmailIgnoreCase(email)) {
			log.warn("Skipping default {} — email {} already exists with another role", role, email);
			return;
		}
		User user = new User();
		user.setEmail(email);
		user.setPasswordHash(passwords.encode(email));
		user.setFirstName(firstName);
		user.setLastName(lastName);
		user.setRole(role);
		users.save(user);
		log.warn("Created default {} account {} (password = email); change after first login", role, email);
	}
}
