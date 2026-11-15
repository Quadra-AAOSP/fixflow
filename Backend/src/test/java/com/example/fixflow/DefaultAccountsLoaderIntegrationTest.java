package com.example.fixflow;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import com.example.fixflow.config.DefaultAccountsLoader;
import com.example.fixflow.domain.Site;
import com.example.fixflow.domain.SiteType;
import com.example.fixflow.domain.UserRole;
import com.example.fixflow.repository.SiteRepository;
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

	@Autowired
	SiteRepository sites;

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
	@Transactional
	void createsSiteAdminsForTheThreeBuiltInSites() {
		// The H2 test configuration builds tables from entities, without the MySQL seed.
		saveSite("CNU School", SiteType.school);
		saveSite("CNU Hostel", SiteType.hostel);
		saveSite("CNU Hotel", SiteType.hotel);
		loader.run(new DefaultApplicationArguments(new String[0]));
		assertSiteAdmin("admin@fixflow.test", "CNU School");
		assertSiteAdmin("admin1.site2@fixflow.test", "CNU Hostel");
		assertSiteAdmin("admin1.site3@fixflow.test", "CNU Hotel");
		loader.run(new DefaultApplicationArguments(new String[0]));
		assertThat(users.findByRoleOrderByLastNameAscFirstNameAsc(UserRole.admin)).hasSize(3);
	}

	private void saveSite(String name, SiteType type) {
		var site = new Site();
		site.setName(name);
		site.setType(type);
		sites.save(site);
	}

	private void assertSiteAdmin(String email, String siteName) {
		var admin = users.findByEmailIgnoreCase(email).orElseThrow();
		assertThat(admin.getRole()).isEqualTo(UserRole.admin);
		assertThat(admin.getSite().getName()).isEqualTo(siteName);
		assertThat(passwords.matches(email, admin.getPasswordHash())).isTrue();
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
