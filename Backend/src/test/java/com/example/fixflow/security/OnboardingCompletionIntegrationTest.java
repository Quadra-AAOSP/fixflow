package com.example.fixflow.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import com.example.fixflow.domain.*;
import com.example.fixflow.repository.*;
import com.example.fixflow.service.TechnicianTermsService;
import com.example.fixflow.web.ApiException;

@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:onboarding-completion;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE",
    "fixflow.technician-terms.version=v2", "fixflow.technician-terms.document-url=https://example.test/terms/v2",
    "fixflow.technician-terms.required=true", "fixflow.reporting.require-site-setup=true"})
class OnboardingCompletionIntegrationTest {
    @Autowired WebApplicationContext context;
    @Autowired SiteRepository sites;
    @Autowired UserRepository users;
    @Autowired SubsiteRepository subsites;
    @Autowired ReportRepository reports;
    @Autowired TechnicianContractRepository contracts;
    @Autowired TechnicianContractApplicationRepository applications;
    @Autowired TechnicianTermsAcceptanceRepository acceptances;
    private MockMvc mvc;
    private Site site, foreign;
    private User admin, reporter, technician, foreignAdmin;
    private Subsite building;
    @BeforeEach void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        site = site("Campus"); foreign = site("Other");
        admin = account(UserRole.admin, site); reporter = account(UserRole.reporter, site);
        technician = account(UserRole.technician, null); foreignAdmin = account(UserRole.admin, foreign);
        building = new Subsite(); building.setSite(site); building.setLabel("E5"); building.setName("Classroom building");
        building = subsites.save(building);
    }
    private Site site(String name) {
        Site s = new Site(); s.setName(name); s.setType(SiteType.school); s.setContractStatus(ContractStatus.uncontracted); return sites.save(s);
    }
    private User account(UserRole role, Site site) {
        User u = new User(); u.setEmail("onboarding-" + System.nanoTime() + "@example.com"); u.setPasswordHash("unused");
        u.setFirstName("Test"); u.setLastName("User"); u.setRole(role); u.setSite(site); return users.save(u);
    }
    private String subsitePath() { return "/api/sites/" + site.getId() + "/subsites/" + building.getId(); }
    private void acceptTerms() throws Exception {
        mvc.perform(post("/api/technician-terms/accept").with(user(new AppUserDetails(technician)))
                .contentType(MediaType.APPLICATION_JSON).content("{\"version\":\"v2\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.acceptedCurrentVersion").value(true));
    }
    @Test void subsiteUpdatesRequireOwnAdminAndRejectDuplicateLabels() throws Exception {
        String body = "{\"label\":\"e6\",\"name\":\"Library\"}";
        for (User actor : new User[]{reporter, foreignAdmin}) {
            mvc.perform(put(subsitePath()).with(user(new AppUserDetails(actor))).contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isForbidden());
        }
        mvc.perform(put(subsitePath()).with(user(new AppUserDetails(admin))).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andExpect(jsonPath("$.label").value("E6"));
        assertThat(subsites.findById(building.getId()).orElseThrow().getName()).isEqualTo("Library");
        Subsite duplicate = new Subsite(); duplicate.setSite(site); duplicate.setLabel("E7"); duplicate.setName("Other"); subsites.save(duplicate);
        mvc.perform(put(subsitePath()).with(user(new AppUserDetails(admin))).contentType(MediaType.APPLICATION_JSON)
                .content("{\"label\":\"e7\",\"name\":\"Duplicate\"}")).andExpect(status().isConflict());
        mvc.perform(put("/api/sites/" + foreign.getId() + "/subsites/" + building.getId())
                .with(user(new AppUserDetails(foreignAdmin))).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isNotFound());
    }
    @Test void archivePreservesReportReferencesAndBlocksNewSelection() throws Exception {
        Report report = new Report(); report.setSite(site); report.setSubsite(building); report.setCreatedBy(reporter);
        report.setDescription("Leak"); report.setCategory("plumbing"); report.setReporterUrgency(Urgency.low); report = reports.save(report);
        mvc.perform(post(subsitePath() + "/archive").with(user(new AppUserDetails(reporter)))).andExpect(status().isForbidden());
        mvc.perform(post(subsitePath() + "/archive").with(user(new AppUserDetails(admin))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.archivedAt").isNotEmpty());
        mvc.perform(post(subsitePath() + "/archive").with(user(new AppUserDetails(admin)))).andExpect(status().isOk());
        mvc.perform(get("/api/sites/" + site.getId() + "/subsites").with(user(new AppUserDetails(reporter))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(get("/api/reports/" + report.getId()).with(user(new AppUserDetails(admin))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.subsiteId").value(building.getId()));
        mvc.perform(post("/api/reports").with(user(new AppUserDetails(reporter))).contentType(MediaType.APPLICATION_JSON)
                .content("{\"description\":\"Leak\",\"category\":\"plumbing\",\"reporterUrgency\":\"low\",\"subsiteId\":" + building.getId() + "}"))
                .andExpect(status().isBadRequest());
        mvc.perform(put(subsitePath()).with(user(new AppUserDetails(admin))).contentType(MediaType.APPLICATION_JSON)
                .content("{\"label\":\"E5\",\"name\":\"Updated\"}")).andExpect(status().isConflict());
    }
    @Test void missingBuildingAlertWorksWithExistingBuildings() throws Exception {
        String path = "/api/sites/" + site.getId() + "/subsite-requests";
        mvc.perform(post(path).with(user(new AppUserDetails(reporter))).contentType(MediaType.APPLICATION_JSON)
                .content("{\"note\":\"E6 Library is missing\"}")).andExpect(status().isCreated());
        mvc.perform(post(path).with(user(new AppUserDetails(reporter))).contentType(MediaType.APPLICATION_JSON)
                .content("{\"note\":\"Repeated\"}")).andExpect(status().isConflict());
    }
    @Test void currentTermsGateRequestsAndAllowScopedAdminStatus() throws Exception {
        String request = "{\"siteId\":" + site.getId() + "}";
        mvc.perform(post("/api/technician-contract-requests").with(user(new AppUserDetails(technician)))
                .contentType(MediaType.APPLICATION_JSON).content(request)).andExpect(status().isConflict());
        mvc.perform(post("/api/technician-terms/accept").with(user(new AppUserDetails(technician)))
                .contentType(MediaType.APPLICATION_JSON).content("{\"version\":\"v1\"}")).andExpect(status().isConflict());
        acceptTerms(); acceptTerms();
        assertThat(acceptances.findByTechnician_IdOrderByAcceptedAtDesc(technician.getId())).hasSize(1);
        assertThat(acceptances.findByTechnician_IdOrderByAcceptedAtDesc(technician.getId()).getFirst().getAcceptedAt()).isNotNull();
        mvc.perform(post("/api/technician-contract-requests").with(user(new AppUserDetails(technician)))
                .contentType(MediaType.APPLICATION_JSON).content(request)).andExpect(status().isCreated());
        mvc.perform(get("/api/technician-terms/" + technician.getId()).with(user(new AppUserDetails(admin))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.acceptedCurrentVersion").value(true));
        mvc.perform(get("/api/technician-terms/" + technician.getId()).with(user(new AppUserDetails(foreignAdmin)))).andExpect(status().isForbidden());
        mvc.perform(get("/api/technician-terms/" + technician.getId()).with(user(new AppUserDetails(reporter)))).andExpect(status().isForbidden());
        mvc.perform(post("/api/technician-terms/accept").with(user(new AppUserDetails(admin)))
                .contentType(MediaType.APPLICATION_JSON).content("{\"version\":\"v2\"}")).andExpect(status().isForbidden());
    }
    @Test void outdatedTermsRequireReacceptanceAndPreserveHistory() throws Exception {
        TechnicianTermsAcceptance old = new TechnicianTermsAcceptance(); old.setTechnician(technician);
        old.setTermsVersion("v1"); old.setDocumentUrl("https://example.test/terms/v1"); acceptances.save(old);
        mvc.perform(get("/api/technician-terms/me").with(user(new AppUserDetails(technician))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.acceptedCurrentVersion").value(false));
        acceptTerms();
        assertThat(acceptances.findByTechnician_IdOrderByAcceptedAtDesc(technician.getId())).hasSize(2);
    }
    @Test void termsGateDirectContractsAssignmentsAndPendingApproval() throws Exception {
        mvc.perform(post("/api/technician-contracts").with(user(new AppUserDetails(admin))).contentType(MediaType.APPLICATION_JSON)
                .content("{\"technicianId\":" + technician.getId() + ",\"siteId\":" + site.getId() + "}")).andExpect(status().isConflict());
        TechnicianContractApplication a = new TechnicianContractApplication(); a.setTechnician(technician); a.setSite(site); a = applications.save(a);
        mvc.perform(post("/api/technician-contract-requests/" + a.getId() + "/decision").with(user(new AppUserDetails(admin)))
                .contentType(MediaType.APPLICATION_JSON).content("{\"decision\":\"approve\"}")).andExpect(status().isConflict());
        assertThat(applications.findById(a.getId()).orElseThrow().getStatus()).isEqualTo(TechnicianContractApplication.Status.pending);
        assertThat(contracts.existsByTechnician_IdAndSite_Id(technician.getId(), site.getId())).isFalse();
        Report report = new Report(); report.setSite(site); report.setCreatedBy(admin); report.setDescription("Leak");
        report.setCategory("plumbing"); report.setReporterUrgency(Urgency.low); report = reports.save(report);
        mvc.perform(post("/api/reports/" + report.getId() + "/assign").with(user(new AppUserDetails(admin)))
                .contentType(MediaType.APPLICATION_JSON).content("{\"technicianId\":" + technician.getId() + "}")).andExpect(status().isConflict());
        acceptTerms();
        mvc.perform(post("/api/technician-contract-requests/" + a.getId() + "/decision").with(user(new AppUserDetails(admin)))
                .contentType(MediaType.APPLICATION_JSON).content("{\"decision\":\"approve\"}")).andExpect(status().isOk());
        assertThat(contracts.existsByTechnician_IdAndSite_Id(technician.getId(), site.getId())).isTrue();
    }
    @Test void requiredTermsCannotStartWithoutApprovedConfiguration() {
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> new TechnicianTermsService(acceptances, users, contracts, applications, "", "", true))
                .isInstanceOf(IllegalArgumentException.class);
    }
    @Test void emptySiteRequiresSetupButAllowsMissingBuildingAlert() throws Exception {
        User emptyReporter = account(UserRole.reporter, foreign);
        mvc.perform(get("/api/sites/" + foreign.getId() + "/reporting-setup").with(user(new AppUserDetails(emptyReporter))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.reportingReady").value(false));
        mvc.perform(post("/api/reports").with(user(new AppUserDetails(emptyReporter))).contentType(MediaType.APPLICATION_JSON)
                .content("{\"description\":\"Leak\",\"category\":\"plumbing\",\"reporterUrgency\":\"low\"}"))
                .andExpect(status().isConflict());
        mvc.perform(post("/api/sites/" + foreign.getId() + "/subsite-requests").with(user(new AppUserDetails(emptyReporter)))
                .contentType(MediaType.APPLICATION_JSON).content("{\"note\":\"Please configure buildings\"}"))
                .andExpect(status().isCreated());
        mvc.perform(get("/api/sites/" + site.getId() + "/reporting-setup").with(user(new AppUserDetails(reporter))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.reportingReady").value(true));
        mvc.perform(post("/api/reports").with(user(new AppUserDetails(reporter))).contentType(MediaType.APPLICATION_JSON)
                .content("{\"description\":\"Leak\",\"category\":\"plumbing\",\"reporterUrgency\":\"low\"}"))
                .andExpect(status().isCreated());
    }
}
