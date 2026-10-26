package com.example.fixflow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import com.example.fixflow.domain.AvailabilityStatus;
import com.example.fixflow.domain.ContractStatus;
import com.example.fixflow.domain.Site;
import com.example.fixflow.domain.SiteType;
import com.example.fixflow.domain.TechnicianAvailability;
import com.example.fixflow.domain.TechnicianContract;
import com.example.fixflow.domain.TechnicianSkill;
import com.example.fixflow.domain.User;
import com.example.fixflow.domain.UserRole;
import com.example.fixflow.repository.SiteRepository;
import com.example.fixflow.repository.TechnicianAvailabilityRepository;
import com.example.fixflow.repository.TechnicianContractRepository;
import com.example.fixflow.repository.TechnicianSkillRepository;
import com.example.fixflow.repository.UserRepository;
import com.example.fixflow.security.AppUserDetails;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

@SpringBootTest
class TechnicianDirectoryApiIntegrationTest {

	@Autowired
	private WebApplicationContext webApplicationContext;

	@Autowired
	private SiteRepository siteRepository;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private TechnicianSkillRepository technicianSkillRepository;

	@Autowired
	private TechnicianContractRepository technicianContractRepository;

	@Autowired
	private TechnicianAvailabilityRepository technicianAvailabilityRepository;

	private MockMvc mockMvc;
	private User technician;
	private User staff;
	private User admin;
	private User reporter;

	@BeforeEach
	void setUp() {
		mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
				.apply(springSecurity()).defaultRequest(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/").with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf()))
				.build();

		Site site = siteRepository.findAll().stream().findFirst().orElseGet(() -> {
			Site created = new Site();
			created.setName("Directory Site");
			created.setType(SiteType.hostel);
			created.setContractStatus(ContractStatus.contracted);
			return siteRepository.save(created);
		});

		technician = account(UserRole.technician, null, "Ana", "Cruz");
		staff = account(UserRole.staff, site, "Staff", "Member");
		admin = account(UserRole.admin, site, "Site", "Admin");
		reporter = account(UserRole.reporter, site, "Rep", "Orter");

		TechnicianAvailability availability = new TechnicianAvailability();
		availability.setTechnician(technician);
		availability.setStatus(AvailabilityStatus.available);
		technicianAvailabilityRepository.save(availability);

		TechnicianSkill skill = new TechnicianSkill();
		skill.setTechnician(technician);
		skill.setCategory("Plumbing");
		skill.setSpecialty("Pipe repair");
		skill.setProficiency(4);
		technicianSkillRepository.save(skill);

		TechnicianContract contract = new TechnicianContract();
		contract.setTechnician(technician);
		contract.setSite(site);
		technicianContractRepository.save(contract);
	}

	private User account(UserRole role, Site site, String firstName, String lastName) {
		User created = new User();
		created.setEmail(role + "-directory-" + System.nanoTime() + "@example.com");
		created.setPasswordHash("unused");
		created.setFirstName(firstName);
		created.setLastName(lastName);
		created.setRole(role);
		created.setSite(site);
		return userRepository.save(created);
	}

	@Test
	void anonymousCannotListTechnicians() throws Exception {
		mockMvc.perform(get("/api/technicians"))
				.andExpect(status().isUnauthorized());
	}

	@Test
	void technicianAndReporterCannotListTechnicians() throws Exception {
		mockMvc.perform(get("/api/technicians").with(user(new AppUserDetails(technician))))
				.andExpect(status().isForbidden());
		mockMvc.perform(get("/api/technicians").with(user(new AppUserDetails(reporter))))
				.andExpect(status().isForbidden());
	}

	@Test
	void staffSeesExpectedDirectoryShape() throws Exception {
		String body = mockMvc.perform(get("/api/technicians").with(user(new AppUserDetails(staff))))
				.andExpect(status().isOk())
				.andReturn().getResponse().getContentAsString();
		assertDirectoryEntry(body);
	}

	@Test
	void adminSeesExpectedDirectoryShape() throws Exception {
		String body = mockMvc.perform(get("/api/technicians").with(user(new AppUserDetails(admin))))
				.andExpect(status().isOk())
				.andReturn().getResponse().getContentAsString();
		assertDirectoryEntry(body);
	}

	private void assertDirectoryEntry(String body) throws Exception {
		JsonNode array = new ObjectMapper().readTree(body);
		assertThat(array.isArray()).isTrue();

		JsonNode entry = null;
		for (JsonNode node : array) {
			if (technician.getEmail().equals(node.path("email").asText())) {
				entry = node;
			}
		}
		assertThat(entry).as("technician entry present in directory").isNotNull();
		assertThat(entry.path("id").asLong()).isEqualTo(technician.getId());
		assertThat(entry.path("firstName").asText()).isEqualTo("Ana");
		assertThat(entry.path("lastName").asText()).isEqualTo("Cruz");
		assertThat(entry.path("phone").isNull()).isTrue();
		assertThat(entry.path("availabilityStatus").asText()).isEqualTo("available");

		assertThat(entry.path("skills").isArray()).isTrue();
		assertThat(entry.path("skills").size()).isEqualTo(1);
		assertThat(entry.path("skills").get(0).path("category").asText()).isEqualTo("Plumbing");
		assertThat(entry.path("skills").get(0).path("specialty").asText()).isEqualTo("Pipe repair");
		assertThat(entry.path("skills").get(0).path("proficiency").asInt()).isEqualTo(4);

		assertThat(entry.path("contracts").isArray()).isTrue();
		assertThat(entry.path("contracts").size()).isEqualTo(1);
		assertThat(entry.path("contracts").get(0).path("siteId").asLong()).isPositive();
		assertThat(entry.path("contracts").get(0).path("siteName").asText()).isNotBlank();
		assertThat(entry.path("contracts").get(0).path("createdAt").asText()).isNotBlank();
	}
}
