package com.example.fixflow;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.example.fixflow.config.DefaultAccountsLoader;
import com.example.fixflow.domain.UserRole;
import com.example.fixflow.repository.UserRepository;

@SpringBootTest(properties = {
		"spring.datasource.url=jdbc:h2:mem:default-accounts;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE",
		"fixflow.seed.demo-enabled=false"
})
class DefaultAccountsLoaderIntegrationTest {

	@Autowired
	DefaultAccountsLoader loader;

	@Autowired
	UserRepository users;

	@Autowired
	PasswordEncoder passwords;

	@Test
	void createsOneSuperAdminAndOneShopManagerOnFreshDatabase() {
		assertThat(users.findByEmailIgnoreCase(DefaultAccountsLoader.SUPER_ADMIN_EMAIL)).isPresent();
		assertThat(users.findByEmailIgnoreCase(DefaultAccountsLoader.SHOP_MANAGER_EMAIL)).isPresent();
		assertThat(users.findByEmailIgnoreCase(DefaultAccountsLoader.SUPER_ADMIN_EMAIL).orElseThrow().getRole())
				.isEqualTo(UserRole.super_admin);
		assertThat(users.findByEmailIgnoreCase(DefaultAccountsLoader.SHOP_MANAGER_EMAIL).orElseThrow().getRole())
				.isEqualTo(UserRole.shop_manager);
		assertThat(passwords.matches(DefaultAccountsLoader.SUPER_ADMIN_EMAIL,
				users.findByEmailIgnoreCase(DefaultAccountsLoader.SUPER_ADMIN_EMAIL).orElseThrow().getPasswordHash()))
				.isTrue();
		assertThat(passwords.matches(DefaultAccountsLoader.SHOP_MANAGER_EMAIL,
				users.findByEmailIgnoreCase(DefaultAccountsLoader.SHOP_MANAGER_EMAIL).orElseThrow().getPasswordHash()))
				.isTrue();
	}

	@Test
	void doesNotDuplicateAccountsWhenRolesAlreadyExist() {
		long before = users.count();
		loader.run(new DefaultApplicationArguments(new String[0]));
		assertThat(users.count()).isEqualTo(before);
		assertThat(users.findByRoleOrderByLastNameAscFirstNameAsc(UserRole.super_admin)).hasSize(1);
		assertThat(users.findByRoleOrderByLastNameAscFirstNameAsc(UserRole.shop_manager)).hasSize(1);
	}
}
