package com.example.fixflow;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
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
import com.example.fixflow.repository.ReportRepository;
import com.example.fixflow.repository.SiteRepository;
import com.example.fixflow.repository.UserRepository;
import com.example.fixflow.security.AppUserDetails;
import com.jayway.jsonpath.JsonPath;

/**
 * Super-admin cross-site oversight: listing reports from every site and
 * nudging a site administrator about a report nobody has picked up.
 */
@SpringBootTest
class ReportOversightIntegrationTest {

	@Autowired
	private WebApplicationContext webApplicationContext;
	@Autowired
	private SiteRepository siteRepository;
	@Autowired
	private ReportRepository reports;
	@Autowired
	private UserRepository userRepository;
	@Autowired
	private PasswordEncoder passwordEncoder;

	private MockMvc mockMvc;
	private Site firstSite;
	private Site secondSite;
	private User superAdmin;
	private User firstAdmin;
	private User secondAdmin;
	private User firstReporter;
	private User secondReporter;

	@BeforeEach
	void setUp() {
		mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
				.apply(springSecurity())
				.defaultRequest(get("/").with(csrf()))
				.build();
		firstSite = createSite("Oversight site A");
		secondSite = createSite("Oversight site B");
		superAdmin = createUser("oversight-super", UserRole.super_admin, null);
		firstAdmin = createUser("oversight-admin-a", UserRole.admin, firstSite);
		secondAdmin = createUser("oversight-admin-b", UserRole.admin, secondSite);
		firstReporter = createUser("oversight-reporter-a", UserRole.reporter, firstSite);
		secondReporter = createUser("oversight-reporter-b", UserRole.reporter, secondSite);
	}

	@Test
	void superAdminSearchesEverySiteWhileSiteAdminStaysScoped() throws Exception {
		Number firstReport = createReport(firstReporter, "Lights out in hall A");
		Number secondReport = createReport(secondReporter, "Lights out in hall B");

		mockMvc.perform(post("/api/reports/search")
						.with(user(new AppUserDetails(superAdmin)))
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"siteId":null,"filters":{"unattended":true},"page":0,"size":50}
								"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content[?(@.id == " + firstReport + ")]").isNotEmpty())
				.andExpect(jsonPath("$.content[?(@.id == " + secondReport + ")]").isNotEmpty());

		// A site admin keeps their single-site scope: the same body must not
		// leak the other site's report.
		mockMvc.perform(post("/api/reports/search")
						.with(user(new AppUserDetails(firstAdmin)))
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"siteId":null,"filters":{"unattended":true},"page":0,"size":50}
								"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content[?(@.id == " + firstReport + ")]").isNotEmpty())
				.andExpect(jsonPath("$.content[?(@.id == " + secondReport + ")]").isEmpty());
	}

	@Test
	void notifyingSiteAdminDeliversAnInboxNoticeToThatSiteOnly() throws Exception {
		Number reportId = createReport(firstReporter, "Broken window, nobody assigned");

		mockMvc.perform(post("/api/reports/{id}/notify-site-admin", reportId)
						.with(user(new AppUserDetails(superAdmin))))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.recipients").value(1))
				.andExpect(jsonPath("$.siteName").value(firstSite.getName()));

		mockMvc.perform(get("/api/notifications").with(user(new AppUserDetails(firstAdmin))))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content[0].reportId").value(reportId))
				.andExpect(jsonPath("$.content[0].type").value("report_unattended"));

		mockMvc.perform(get("/api/notifications").with(user(new AppUserDetails(secondAdmin))))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content").isEmpty());

		// The nudge is recorded on the report timeline as an audit note.
		mockMvc.perform(get("/api/reports/{id}/history", reportId)
						.with(user(new AppUserDetails(superAdmin))))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[?(@.note == 'Site administrator notified about unattended report')]")
						.isNotEmpty());
	}

	@Test
	void onlySuperAdminsMayNotifyAndOnlyWhileUnattended() throws Exception {
		Number reportId = createReport(firstReporter, "Leaking pipe, nobody assigned");

		mockMvc.perform(post("/api/reports/{id}/notify-site-admin", reportId)
						.with(user(new AppUserDetails(firstAdmin))))
				.andExpect(status().isForbidden());

		// Once a technician is assigned the report is no longer "unattended".
		var report = reports.findById(reportId.longValue()).orElseThrow();
		report.setAssignedTechnician(createUser("oversight-tech", UserRole.technician, null));
		reports.saveAndFlush(report);

		mockMvc.perform(post("/api/reports/{id}/notify-site-admin", reportId)
						.with(user(new AppUserDetails(superAdmin))))
				.andExpect(status().isConflict());
	}

	private Number createReport(User reporter, String description) throws Exception {
		MvcResult created = mockMvc.perform(post("/api/reports")
						.with(user(new AppUserDetails(reporter)))
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"description":"%s","category":"plumbing","reporterUrgency":"medium"}
								""".formatted(description)))
				.andExpect(status().isCreated())
				.andReturn();
		return JsonPath.read(created.getResponse().getContentAsString(), "$.id");
	}

	private Site createSite(String name) {
		Site site = new Site();
		site.setName(name);
		site.setType(SiteType.school);
		site.setContractStatus(ContractStatus.contracted);
		return siteRepository.save(site);
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
