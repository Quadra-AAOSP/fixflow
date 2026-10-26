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
				.apply(springSecurity()).defaultRequest(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/").with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf()))
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
	void siteAdminSeesSetupRequirementUntilAnActiveSubsiteExists() throws Exception {
		Site empty = new Site();
		empty.setName("Setup " + System.nanoTime());
		empty.setType(SiteType.school);
		empty.setContractStatus(ContractStatus.contracted);
		empty = siteRepository.save(empty);
		User admin = new User();
		admin.setEmail("setup-" + System.nanoTime() + "@example.com");
		admin.setFirstName("Site");
		admin.setLastName("Admin");
		admin.setPasswordHash(new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder()
				.encode("setup-password12345"));
		admin.setRole(UserRole.admin);
		admin.setSite(empty);
		admin = userRepository.save(admin);
		AppUserDetails actor = new AppUserDetails(admin);
		mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"email":"%s","password":"setup-password12345"}
						""".formatted(admin.getEmail())))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.siteOnboarding.setupRequired").value(true));
		mockMvc.perform(get("/api/auth/me").with(user(actor)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.siteOnboarding.setupRequired").value(true))
				.andExpect(jsonPath("$.siteOnboarding.reportingReady").value(false));
		mockMvc.perform(post("/api/sites/" + empty.getId() + "/subsites").with(user(actor))
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"label":"E5","name":"Classroom building"}
						"""))
				.andExpect(status().isCreated());
		mockMvc.perform(get("/api/auth/me").with(user(actor)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.siteOnboarding.setupRequired").value(false))
				.andExpect(jsonPath("$.siteOnboarding.reportingReady").value(true));
	}

	@Test
	void registerReporterThenLoginAndMe() throws Exception {
		String email = "reporter" + System.nanoTime() + "@example.com";
		String body = """
				{
				  "email": "%s",
				  "password": "password12345678",
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
								{"email":"%s","password":"password12345678"}
								""".formatted(email)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.email").value(email));
	}

	@Test
	void siteAdminRegistrationRequiresSuperAdminApproval() throws Exception {
		String body = """
				{
				  "email": "badadmin%s@example.com",
				  "password": "password12345678",
				  "firstName": "Bad",
				  "lastName": "Admin",
				  "role": "admin",
				  "siteId": %d
				}
				""".formatted(System.nanoTime(), site.getId());

		var result = mockMvc.perform(post("/api/auth/register")
						.contentType(MediaType.APPLICATION_JSON)
						.content(body))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.role").value("reporter"))
				.andExpect(jsonPath("$.adminApplication.status").value("pending"))
				.andReturn();
		var json = new com.fasterxml.jackson.databind.ObjectMapper()
				.readTree(result.getResponse().getContentAsString());
		long id = json.get("adminApplication").get("id").asLong();
		User applicant = userRepository.findById(json.get("id").asLong()).orElseThrow();
		mockMvc.perform(post("/api/admin/site-admin-applications/" + id + "/approve")
				.with(user(new AppUserDetails(applicant)))).andExpect(status().isForbidden());
		User superAdmin = new User();
		superAdmin.setEmail("approver-" + System.nanoTime() + "@example.com");
		superAdmin.setFirstName("Super"); superAdmin.setLastName("Admin");
		superAdmin.setPasswordHash("unused"); superAdmin.setRole(UserRole.super_admin);
		superAdmin = userRepository.save(superAdmin);
		mockMvc.perform(post("/api/admin/site-admin-applications/" + id + "/approve")
				.with(user(new AppUserDetails(superAdmin))))
				.andExpect(status().isOk()).andExpect(jsonPath("$.status").value("approved"));
		org.assertj.core.api.Assertions.assertThat(userRepository.findById(applicant.getId())
				.orElseThrow().getRole()).isEqualTo(UserRole.admin);
		mockMvc.perform(post("/api/admin/site-admin-applications/" + id + "/reject")
				.with(user(new AppUserDetails(superAdmin)))).andExpect(status().isConflict());
		var rejectedSignup = mockMvc.perform(post("/api/auth/register")
				.contentType(MediaType.APPLICATION_JSON).content(body.replace("badadmin", "rejectedadmin")))
				.andExpect(status().isCreated()).andReturn();
		var rejected = new com.fasterxml.jackson.databind.ObjectMapper()
				.readTree(rejectedSignup.getResponse().getContentAsString());
		mockMvc.perform(post("/api/admin/site-admin-applications/"
				+ rejected.get("adminApplication").get("id").asLong() + "/reject")
				.with(user(new AppUserDetails(superAdmin))))
				.andExpect(status().isOk()).andExpect(jsonPath("$.status").value("rejected"));
		org.assertj.core.api.Assertions.assertThat(userRepository.findById(rejected.get("id").asLong())
				.orElseThrow().getRole()).isEqualTo(UserRole.reporter);
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
				  "password": "password12345678",
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

    @Test
    void policyIsPublicAndReturnedCapabilitiesAreServerOwned() throws Exception {
        mockMvc.perform(get("/api/auth/policy"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.passwordMinLength").value(15));
        User account = new User(); account.setEmail("legacy-" + System.nanoTime() + "@example.test");
        account.setPasswordHash(new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder().encode("oldpass8"));
        account.setFirstName("Legacy"); account.setLastName("Admin"); account.setRole(UserRole.admin); account.setSite(site);
        userRepository.save(account);
        mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + account.getEmail() + "\",\"password\":\"oldpass8\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.capabilities.provision").value(true));
    }
}
