package com.example.fixflow;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import com.example.fixflow.domain.ContractStatus;
import com.example.fixflow.domain.Site;
import com.example.fixflow.domain.SiteType;
import com.example.fixflow.domain.User;
import com.example.fixflow.domain.UserRole;
import com.example.fixflow.repository.SiteRepository;
import com.example.fixflow.repository.UserRepository;
import com.example.fixflow.security.AppUserDetails;

@SpringBootTest
class SiteApiIntegrationTest {

	@Autowired
	private WebApplicationContext webApplicationContext;

	@Autowired
	private SiteRepository siteRepository;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private PasswordEncoder passwordEncoder;

	private MockMvc mockMvc;
	private User superAdmin;
	private User reporter;

	@BeforeEach
	void setUp() {
		mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
				.apply(springSecurity())
				.build();

		Site existing = siteRepository.findAll().stream().findFirst().orElseGet(() -> {
			Site created = new Site();
			created.setName("Hostel One");
			created.setType(SiteType.hostel);
			created.setContractStatus(ContractStatus.uncontracted);
			return siteRepository.save(created);
		});

		superAdmin = userRepository.findByEmailIgnoreCase("admin@fixflow.local")
				.orElseGet(() -> {
					User created = new User();
					created.setEmail("admin@fixflow.local");
					created.setPasswordHash(passwordEncoder.encode("test-admin-pass"));
					created.setFirstName("Super");
					created.setLastName("Admin");
					created.setRole(UserRole.super_admin);
					return userRepository.save(created);
				});

		reporter = new User();
		reporter.setEmail("reporter-site-test-" + System.nanoTime() + "@example.com");
		reporter.setPasswordHash(passwordEncoder.encode("password123"));
		reporter.setFirstName("Rep");
		reporter.setLastName("Orter");
		reporter.setRole(UserRole.reporter);
		reporter.setSite(existing);
		reporter = userRepository.save(reporter);
	}

	@Test
	void superAdminCanCreateSite() throws Exception {
		String body = """
				{
				  "name": "Hotel %s",
				  "type": "hotel",
				  "contractStatus": "contracted",
				  "address": "1 Main St"
				}
				""".formatted(System.nanoTime());

		mockMvc.perform(post("/api/sites")
						.with(user(new AppUserDetails(superAdmin)))
						.contentType(MediaType.APPLICATION_JSON)
						.content(body))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.type").value("hotel"))
				.andExpect(jsonPath("$.contractStatus").value("contracted"));
	}

	@Test
	void reporterCannotCreateSite() throws Exception {
		String body = """
				{
				  "name": "Forbidden Site",
				  "type": "school",
				  "contractStatus": "uncontracted"
				}
				""";

		mockMvc.perform(post("/api/sites")
						.with(user(new AppUserDetails(reporter)))
						.contentType(MediaType.APPLICATION_JSON)
						.content(body))
				.andExpect(status().isForbidden());
	}

	@Test
	void authenticatedUserCanListSiteRules() throws Exception {
		mockMvc.perform(get("/api/site-rules")
						.param("siteType", "school")
						.with(user(new AppUserDetails(reporter))))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[0].category").exists());
	}

	@Test
	void unauthenticatedCannotListSites() throws Exception {
		mockMvc.perform(get("/api/sites"))
				.andExpect(status().isUnauthorized());
	}
}
