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
class AuthApiIntegrationTest {

	@Autowired
	private WebApplicationContext webApplicationContext;

	@Autowired
	private SiteRepository siteRepository;

	@Autowired
	private UserRepository userRepository;

	private MockMvc mockMvc;
	private Site site;

	@BeforeEach
	void setUp() {
		mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
				.apply(springSecurity())
				.build();
		site = siteRepository.findAll().stream().findFirst().orElseGet(() -> {
			Site created = new Site();
			created.setName("Campus A");
			created.setType(SiteType.school);
			created.setContractStatus(ContractStatus.contracted);
			return siteRepository.save(created);
		});
	}

	@Test
	void registerReporterThenLoginAndMe() throws Exception {
		String email = "reporter" + System.nanoTime() + "@example.com";
		String body = """
				{
				  "email": "%s",
				  "password": "password123",
				  "firstName": "Rep",
				  "lastName": "Orter",
				  "role": "reporter",
				  "siteId": %d
				}
				""".formatted(email, site.getId());

		mockMvc.perform(post("/api/auth/register")
						.contentType(MediaType.APPLICATION_JSON)
						.content(body))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.email").value(email))
				.andExpect(jsonPath("$.role").value("reporter"));

		mockMvc.perform(post("/api/auth/login")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"email":"%s","password":"password123"}
								""".formatted(email)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.email").value(email));
	}

	@Test
	void selfRegisterRejectsAdminRole() throws Exception {
		String body = """
				{
				  "email": "badadmin%s@example.com",
				  "password": "password123",
				  "firstName": "Bad",
				  "lastName": "Admin",
				  "role": "admin",
				  "siteId": %d
				}
				""".formatted(System.nanoTime(), site.getId());

		mockMvc.perform(post("/api/auth/register")
						.contentType(MediaType.APPLICATION_JSON)
						.content(body))
				.andExpect(status().isBadRequest());
	}

	@Test
	void provisionStaffRequiresAdmin() throws Exception {
		User admin = new User();
		admin.setEmail("siteadmin" + System.nanoTime() + "@example.com");
		admin.setPasswordHash("{noop}unused");
		admin.setFirstName("Site");
		admin.setLastName("Admin");
		admin.setRole(UserRole.admin);
		admin.setSite(site);
		admin = userRepository.save(admin);

		String body = """
				{
				  "email": "staff%s@example.com",
				  "password": "password123",
				  "firstName": "Staff",
				  "lastName": "Member",
				  "role": "staff",
				  "siteId": %d
				}
				""".formatted(System.nanoTime(), site.getId());

		mockMvc.perform(post("/api/admin/users")
						.with(user(new AppUserDetails(admin)))
						.contentType(MediaType.APPLICATION_JSON)
						.content(body))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.role").value("staff"));
	}

	@Test
	void meRequiresAuthentication() throws Exception {
		mockMvc.perform(get("/api/auth/me"))
				.andExpect(status().isUnauthorized());
	}
}
