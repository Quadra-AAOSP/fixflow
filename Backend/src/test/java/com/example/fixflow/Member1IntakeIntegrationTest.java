package com.example.fixflow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import com.example.fixflow.domain.AvailabilityStatus;
import com.example.fixflow.domain.ContractStatus;
import com.example.fixflow.domain.ReportStatus;
import com.example.fixflow.domain.Site;
import com.example.fixflow.domain.SiteType;
import com.example.fixflow.domain.User;
import com.example.fixflow.domain.UserRole;
import com.example.fixflow.repository.ReportRepository;
import com.example.fixflow.repository.SiteRepository;
import com.example.fixflow.repository.StatusHistoryRepository;
import com.example.fixflow.repository.UserRepository;
import com.example.fixflow.security.AppUserDetails;
import com.jayway.jsonpath.JsonPath;

@SpringBootTest
class Member1IntakeIntegrationTest {

	@Autowired
	private WebApplicationContext webApplicationContext;
	@Autowired
	private SiteRepository siteRepository;
	@Autowired
	private UserRepository userRepository;
	@Autowired
	private ReportRepository reportRepository;
	@Autowired
	private StatusHistoryRepository statusHistoryRepository;
	@Autowired
	private PasswordEncoder passwordEncoder;

	private MockMvc mockMvc;
	private Site site;
	private User reporter;
	private User admin;
	private User technician;

	@BeforeEach
	void setUp() {
		mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).apply(springSecurity()).build();
		site = new Site();
		site.setName("Member1 Site " + System.nanoTime());
		site.setType(SiteType.school);
		site.setContractStatus(ContractStatus.contracted);
		site = siteRepository.save(site);
		reporter = createUser("m1-reporter", UserRole.reporter, site);
		admin = createUser("m1-admin", UserRole.admin, site);
		technician = createUser("m1-tech", UserRole.technician, null);
	}

	@Test
	void createWritesStatusHistoryAndAcceptsPhoto() throws Exception {
		MockMultipartFile photo = new MockMultipartFile(
				"photos", "leak.jpg", "image/jpeg", new byte[]{1, 2, 3, 4});
		MvcResult created = mockMvc.perform(multipart("/api/reports")
						.file(photo)
						.param("description", "Pipe leak in wing A")
						.param("category", "plumbing")
						.param("reporterUrgency", "high")
						.param("address", "Wing A")
						.with(user(new AppUserDetails(reporter))))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.status").value("open"))
				.andExpect(jsonPath("$.photos.length()").value(1))
				.andExpect(jsonPath("$.photos[0].contentType").value("image/jpeg"))
				.andReturn();

		Number reportId = JsonPath.read(created.getResponse().getContentAsString(), "$.id");
		assertThat(statusHistoryRepository.countByReport_Id(reportId.longValue())).isEqualTo(1);

		Number photoId = JsonPath.read(created.getResponse().getContentAsString(), "$.photos[0].id");
		mockMvc.perform(get("/api/reports/{id}/photos/{photoId}", reportId, photoId)
						.with(user(new AppUserDetails(reporter))))
				.andExpect(status().isOk());
	}

	@Test
	void openBrowseExcludesConfirmedAndSupportsPagination() throws Exception {
		MvcResult first = createOpenReport(reporter, "Open one");
		Number firstId = JsonPath.read(first.getResponse().getContentAsString(), "$.id");
		var confirmed = reportRepository.findById(firstId.longValue()).orElseThrow();
		confirmed.setStatus(ReportStatus.confirmed);
		reportRepository.save(confirmed);
		createOpenReport(reporter, "Open two");

		mockMvc.perform(get("/api/reports")
						.param("siteId", site.getId().toString())
						.param("page", "0")
						.param("size", "10")
						.with(user(new AppUserDetails(reporter))))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content.length()").value(1))
				.andExpect(jsonPath("$.totalElements").value(1))
				.andExpect(jsonPath("$.content[0].description").value("Open two"));
	}

	@Test
	void joinIsIdempotentAndRejectedWhenConfirmed() throws Exception {
		MvcResult created = createOpenReport(reporter, "Joinable");
		Number reportId = JsonPath.read(created.getResponse().getContentAsString(), "$.id");
		User peer = createUser("m1-peer", UserRole.reporter, site);

		mockMvc.perform(post("/api/reports/{id}/join", reportId).with(user(new AppUserDetails(peer))))
				.andExpect(status().isOk());
		mockMvc.perform(post("/api/reports/{id}/join", reportId).with(user(new AppUserDetails(peer))))
				.andExpect(status().isOk());

		var report = reportRepository.findById(reportId.longValue()).orElseThrow();
		report.setStatus(ReportStatus.confirmed);
		reportRepository.save(report);

		User late = createUser("m1-late", UserRole.reporter, site);
		mockMvc.perform(post("/api/reports/{id}/join", reportId).with(user(new AppUserDetails(late))))
				.andExpect(status().isConflict());
	}

	@Test
	void taxonomyAvailabilityContractsAndPool() throws Exception {
		mockMvc.perform(get("/api/sites/{id}/taxonomy", site.getId()).with(user(new AppUserDetails(reporter))))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[0].category").exists());

		mockMvc.perform(get("/api/technicians/me/availability").with(user(new AppUserDetails(reporter))))
				.andExpect(status().isForbidden());

		mockMvc.perform(put("/api/technicians/me/availability")
						.with(user(new AppUserDetails(technician)))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"status\":\"available\"}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value(AvailabilityStatus.available.name()));

		mockMvc.perform(post("/api/technician-contracts")
						.with(user(new AppUserDetails(admin)))
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"technicianId": %d, "siteId": %d}
								""".formatted(technician.getId(), site.getId())))
				.andExpect(status().isCreated());

		mockMvc.perform(get("/api/technician-contracts")
						.param("siteId", site.getId().toString())
						.with(user(new AppUserDetails(admin))))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(1));

		mockMvc.perform(get("/api/sites/{id}/technician-pool", site.getId())
						.with(user(new AppUserDetails(admin))))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[0].technicianId").value(technician.getId()))
				.andExpect(jsonPath("$[0].availability").value("available"));

		MvcResult contracts = mockMvc.perform(get("/api/technician-contracts")
						.param("siteId", site.getId().toString())
						.with(user(new AppUserDetails(admin))))
				.andExpect(status().isOk())
				.andReturn();
		Number contractId = JsonPath.read(contracts.getResponse().getContentAsString(), "$[0].id");
		mockMvc.perform(delete("/api/technician-contracts/{id}", contractId)
						.with(user(new AppUserDetails(admin))))
				.andExpect(status().isNoContent());
	}

	@Test
	void actuatorHealthAndTraceIdArePresent() throws Exception {
		mockMvc.perform(get("/actuator/health"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("UP"));

		MvcResult result = mockMvc.perform(get("/api/sites").with(user(new AppUserDetails(reporter))))
				.andExpect(status().isOk())
				.andReturn();
		assertThat(result.getResponse().getHeader("X-Trace-Id")).isNotBlank();
	}

	private MvcResult createOpenReport(User filer, String description) throws Exception {
		return mockMvc.perform(post("/api/reports")
						.with(user(new AppUserDetails(filer)))
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "description": "%s",
								  "category": "plumbing",
								  "reporterUrgency": "medium"
								}
								""".formatted(description)))
				.andExpect(status().isCreated())
				.andReturn();
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
