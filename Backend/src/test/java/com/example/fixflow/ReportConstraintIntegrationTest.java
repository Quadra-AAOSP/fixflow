package com.example.fixflow;

import static org.hamcrest.Matchers.nullValue;
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
import org.springframework.test.web.servlet.MvcResult;
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
import com.jayway.jsonpath.JsonPath;

@SpringBootTest
class ReportConstraintIntegrationTest {

	@Autowired
	private WebApplicationContext webApplicationContext;

	@Autowired
	private SiteRepository siteRepository;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private PasswordEncoder passwordEncoder;

	private MockMvc mockMvc;
	private Site site;
	private User reporterA;
	private User reporterB;
	private User staff;
	private User technician;

	@BeforeEach
	void setUp() {
		mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
				.apply(springSecurity())
				.build();
		site = siteRepository.findAll().stream().findFirst().orElseGet(() -> {
			Site created = new Site();
			created.setName("School One");
			created.setType(SiteType.school);
			created.setContractStatus(ContractStatus.contracted);
			return siteRepository.save(created);
		});
		reporterA = createUser("reporter-a", UserRole.reporter, site);
		reporterB = createUser("reporter-b", UserRole.reporter, site);
		staff = createUser("staff", UserRole.staff, site);
		technician = createUser("tech", UserRole.technician, null);
	}

	@Test
	void rejectsCategoryNotInSiteRules() throws Exception {
		mockMvc.perform(post("/api/reports")
						.with(user(new AppUserDetails(reporterA)))
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "description": "Broken pipe",
								  "category": "not_a_real_trade",
								  "reporterUrgency": "high"
								}
								"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("taxonomy")));
	}

	@Test
	void rejectsFreeTextUrgency() throws Exception {
		mockMvc.perform(post("/api/reports")
						.with(user(new AppUserDetails(reporterA)))
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "description": "Broken pipe",
								  "category": "plumbing",
								  "reporterUrgency": "urgent"
								}
								"""))
				.andExpect(status().isBadRequest());
	}

	@Test
	void createInsertsCreatorIntoReportReporters() throws Exception {
		MvcResult created = mockMvc.perform(post("/api/reports")
						.with(user(new AppUserDetails(reporterA)))
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "description": "Leaky faucet",
								  "address": "Room 204",
								  "category": "plumbing",
								  "reporterUrgency": "medium"
								}
								"""))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.status").value("open"))
				.andExpect(jsonPath("$.address").value("Room 204"))
				.andExpect(jsonPath("$.createdByUserId").value(reporterA.getId()))
				.andReturn();

		Number reportId = JsonPath.read(created.getResponse().getContentAsString(), "$.id");

		mockMvc.perform(get("/api/reports/{id}/reporters", reportId)
						.with(user(new AppUserDetails(reporterA))))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[0].userId").value(reporterA.getId()));
	}

	@Test
	void masksAddressAndIdentityFromPeerReporters() throws Exception {
		MvcResult created = mockMvc.perform(post("/api/reports")
						.with(user(new AppUserDetails(reporterA)))
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "description": "AC noise",
								  "address": "Room 12B",
								  "category": "hvac",
								  "reporterUrgency": "low"
								}
								"""))
				.andExpect(status().isCreated())
				.andReturn();
		Number reportId = JsonPath.read(created.getResponse().getContentAsString(), "$.id");

		mockMvc.perform(get("/api/reports/{id}", reportId)
						.with(user(new AppUserDetails(reporterB))))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.address").value(nullValue()))
				.andExpect(jsonPath("$.createdByUserId").value(nullValue()))
				.andExpect(jsonPath("$.createdByName").value(nullValue()))
				.andExpect(jsonPath("$.description").value("AC noise"));

		mockMvc.perform(get("/api/reports/{id}", reportId)
						.with(user(new AppUserDetails(staff))))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.address").value("Room 12B"))
				.andExpect(jsonPath("$.createdByUserId").value(reporterA.getId()));
	}

	@Test
	void rejectsContractAndAssignAndSkillForNonTechnician() throws Exception {
		User admin = createUser("admin-role", UserRole.admin, site);

		mockMvc.perform(post("/api/technician-contracts")
						.with(user(new AppUserDetails(admin)))
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"technicianId": %d, "siteId": %d}
								""".formatted(reporterA.getId(), site.getId())))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("not a technician")));

		MvcResult created = mockMvc.perform(post("/api/reports")
						.with(user(new AppUserDetails(reporterA)))
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "description": "Lights out",
								  "category": "electrical",
								  "reporterUrgency": "high"
								}
								"""))
				.andExpect(status().isCreated())
				.andReturn();
		Number reportId = JsonPath.read(created.getResponse().getContentAsString(), "$.id");

		mockMvc.perform(post("/api/reports/{id}/assign", reportId)
						.with(user(new AppUserDetails(admin)))
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"technicianId": %d}
								""".formatted(reporterA.getId())))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("not a technician")));

		mockMvc.perform(post("/api/technician-skills")
						.with(user(new AppUserDetails(admin)))
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"technicianId": %d, "category": "plumbing", "proficiency": 3}
								""".formatted(staff.getId())))
				.andExpect(status().isBadRequest());
	}

	@Test
	void allowsTechnicianContract() throws Exception {
		User admin = createUser("admin-ok", UserRole.admin, site);
		mockMvc.perform(post("/api/technician-contracts")
						.with(user(new AppUserDetails(admin)))
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"technicianId": %d, "siteId": %d}
								""".formatted(technician.getId(), site.getId())))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.technicianId").value(technician.getId()));
	}

	private User createUser(String prefix, UserRole role, Site userSite) {
		User created = new User();
		created.setEmail(prefix + System.nanoTime() + "@example.com");
		created.setPasswordHash(passwordEncoder.encode("password123"));
		created.setFirstName(prefix);
		created.setLastName("User");
		created.setRole(role);
		created.setSite(userSite);
		return userRepository.save(created);
	}
}
