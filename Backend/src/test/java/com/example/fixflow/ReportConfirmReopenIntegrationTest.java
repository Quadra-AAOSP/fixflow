package com.example.fixflow;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
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
import com.example.fixflow.domain.Report;
import com.example.fixflow.domain.ReportReporter;
import com.example.fixflow.domain.ReportStatus;
import com.example.fixflow.domain.Site;
import com.example.fixflow.domain.SiteType;
import com.example.fixflow.domain.Urgency;
import com.example.fixflow.domain.User;
import com.example.fixflow.domain.UserRole;
import com.example.fixflow.repository.ReportReporterRepository;
import com.example.fixflow.repository.ReportRepository;
import com.example.fixflow.repository.SiteRepository;
import com.example.fixflow.repository.UserRepository;
import com.example.fixflow.security.AppUserDetails;

@SpringBootTest
class ReportConfirmReopenIntegrationTest {

	@Autowired
	private WebApplicationContext webApplicationContext;

	@Autowired
	private SiteRepository siteRepository;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private ReportRepository reportRepository;

	@Autowired
	private ReportReporterRepository reportReporterRepository;

	@Autowired
	private PasswordEncoder passwordEncoder;

	private MockMvc mockMvc;
	private Site site;
	private User reporter;
	private User participant;
	private User admin;
	private User technician;
	private Long confirmableReportId;

	@BeforeEach
	void setUp() {
		mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
				.apply(springSecurity())
				.build();
		site = siteRepository.findAll().stream().findFirst().orElseGet(() -> {
			Site created = new Site();
			created.setName("School Confirm");
			created.setType(SiteType.school);
			created.setContractStatus(ContractStatus.contracted);
			return siteRepository.save(created);
		});
		reporter = createUser("confirm-reporter", UserRole.reporter, site);
		participant = createUser("confirm-participant", UserRole.reporter, site);
		admin = createUser("confirm-admin", UserRole.admin, site);
		technician = createUser("confirm-tech", UserRole.technician, null);

		Report report = new Report();
		report.setSite(site);
		report.setCreatedBy(reporter);
		report.setDescription("Waiting confirm");
		report.setCategory("plumbing");
		report.setReporterUrgency(Urgency.high);
		report.setStatus(ReportStatus.resolved_pending_confirmation);
		report = reportRepository.save(report);
		confirmableReportId = report.getId();

		ReportReporter rr = new ReportReporter();
		rr.setReportId(report.getId());
		rr.setUserId(reporter.getId());
		reportReporterRepository.save(rr);
	}

	@Test
	void anonymousConfirmReturns401() throws Exception {
		mockMvc.perform(post("/api/reports/{id}/confirm", confirmableReportId))
				.andExpect(status().isUnauthorized());
	}

	@Test
	void anonymousReopenReturns401() throws Exception {
		mockMvc.perform(post("/api/reports/{id}/reopen", confirmableReportId)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"reason": "test"}
								"""))
				.andExpect(status().isUnauthorized());
	}

	@Test
	void technicianConfirmReturns403() throws Exception {
		mockMvc.perform(post("/api/reports/{id}/confirm", confirmableReportId)
						.with(user(new AppUserDetails(technician))))
				.andExpect(status().isForbidden());
	}

	@Test
	void technicianReopenReturns403() throws Exception {
		mockMvc.perform(post("/api/reports/{id}/reopen", confirmableReportId)
						.with(user(new AppUserDetails(technician)))
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"reason": "test"}
								"""))
				.andExpect(status().isForbidden());
	}

	@Test
	void reporterWhoFiledConfirmReturns200() throws Exception {
		mockMvc.perform(post("/api/reports/{id}/confirm", confirmableReportId)
						.with(user(new AppUserDetails(reporter))))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("confirmed"))
				.andExpect(jsonPath("$.confirmedByUserId").value(reporter.getId()))
				.andExpect(jsonPath("$.confirmedAt").exists());
	}

	@Test
	void reporterWhoJoinedConfirmReturns200() throws Exception {
		mockMvc.perform(post("/api/reports/{id}/join", confirmableReportId)
						.with(user(new AppUserDetails(participant))))
				.andExpect(status().isOk());

		mockMvc.perform(post("/api/reports/{id}/confirm", confirmableReportId)
						.with(user(new AppUserDetails(participant))))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("confirmed"));
	}

	@Test
	void confirmOnConfirmedStatusReturns409() throws Exception {
		mockMvc.perform(post("/api/reports/{id}/confirm", confirmableReportId)
						.with(user(new AppUserDetails(reporter))))
				.andExpect(status().isOk());

		mockMvc.perform(post("/api/reports/{id}/confirm", confirmableReportId)
						.with(user(new AppUserDetails(reporter))))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("not awaiting confirmation")));
	}

	@Test
	void adminConfirmAndReopenReturns200() throws Exception {
		mockMvc.perform(post("/api/reports/{id}/confirm", confirmableReportId)
						.with(user(new AppUserDetails(admin))))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("confirmed"));

		mockMvc.perform(post("/api/reports/{id}/reopen", confirmableReportId)
						.with(user(new AppUserDetails(admin)))
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"reason": "Still not fixed"}
								"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("reopened"))
				.andExpect(jsonPath("$.reopenReason").value("Still not fixed"));
	}

	@Test
	void reopenWithBlankReasonReturns400() throws Exception {
		mockMvc.perform(post("/api/reports/{id}/reopen", confirmableReportId)
						.with(user(new AppUserDetails(reporter)))
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"reason": "   "}
								"""))
				.andExpect(status().isBadRequest());
	}

	@Test
	void reopenTransitionsAndBumpsCount() throws Exception {
		mockMvc.perform(post("/api/reports/{id}/confirm", confirmableReportId)
						.with(user(new AppUserDetails(reporter))))
				.andExpect(status().isOk());

		mockMvc.perform(post("/api/reports/{id}/reopen", confirmableReportId)
						.with(user(new AppUserDetails(reporter)))
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"reason": "Leak persists"}
								"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("reopened"))
				.andExpect(jsonPath("$.reopenCount").value(1))
				.andExpect(jsonPath("$.reopenReason").value("Leak persists"));
	}

	@Test
	void confirmAfterReopenReturns409() throws Exception {
		mockMvc.perform(post("/api/reports/{id}/confirm", confirmableReportId)
						.with(user(new AppUserDetails(reporter))))
				.andExpect(status().isOk());

		mockMvc.perform(post("/api/reports/{id}/reopen", confirmableReportId)
						.with(user(new AppUserDetails(reporter)))
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"reason": "Broken again"}
								"""))
				.andExpect(status().isOk());

		mockMvc.perform(post("/api/reports/{id}/confirm", confirmableReportId)
						.with(user(new AppUserDetails(reporter))))
				.andExpect(status().isConflict());
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
