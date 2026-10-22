package com.example.fixflow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import java.util.UUID;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import com.example.fixflow.domain.*;
import com.example.fixflow.repository.*;
import com.example.fixflow.security.AppUserDetails;

@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:ranking-api;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE")
@org.springframework.transaction.annotation.Transactional
class TechnicianRankingIntegrationTest {
    @Autowired WebApplicationContext context;
    @Autowired SiteRepository sites;
    @Autowired UserRepository users;
    @Autowired ReportRepository reports;
    @Autowired TechnicianContractRepository contracts;
    @Autowired TechnicianSkillRepository skills;
    @Autowired TechnicianAvailabilityRepository availability;
    MockMvc mvc;
    Site site, other;
    User admin, technician, outsider, reporter;
    Report report;
    @BeforeEach void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        site = site(); other = site(); admin = userAccount(UserRole.admin, site);
        technician = userAccount(UserRole.technician, null); outsider = userAccount(UserRole.technician, null);
        reporter = userAccount(UserRole.reporter, site); report = report(site, reporter);
        contract(technician, site); skill(technician); skill(outsider); available(technician);
    }
    Site site() { Site s = new Site(); s.setName("Ranking"); s.setType(SiteType.school); s.setContractStatus(ContractStatus.contracted); return sites.save(s); }
    User userAccount(UserRole role, Site scope) {
        User u = new User(); u.setEmail(UUID.randomUUID() + "@example.test"); u.setPasswordHash("unused");
        u.setFirstName("Test"); u.setLastName("User"); u.setRole(role); u.setSite(scope); return users.save(u);
    }
    Report report(Site scope, User creator) {
        Report r = new Report(); r.setSite(scope); r.setCreatedBy(creator); r.setDescription("Test");
        r.setCategory("plumbing"); r.setReporterUrgency(Urgency.low); return reports.save(r);
    }
    void contract(User u, Site scope) { TechnicianContract c = new TechnicianContract(); c.setTechnician(u); c.setSite(scope); contracts.save(c); }
    void skill(User u) { TechnicianSkill s = new TechnicianSkill(); s.setTechnician(u); s.setCategory("plumbing"); s.setProficiency(4); skills.save(s); }
    void available(User u) { TechnicianAvailability a = new TechnicianAvailability(); a.setTechnician(u); a.setStatus(AvailabilityStatus.available); availability.save(a); }
    String ranking() { return "/api/reports/" + report.getId() + "/technician-ranking"; }
    @Test void ranksOnlyAvailableContractedSkilledTechniciansAndDoesNotLeakForeignWorkload() throws Exception {
        Report foreign = report(other, admin); foreign.setAssignedTechnician(technician); foreign.setStatus(ReportStatus.assigned); reports.save(foreign);
        mvc.perform(post(ranking()).with(user(new AppUserDetails(admin))).contentType(MediaType.APPLICATION_JSON).content("{\"mode\":\"STANDARD\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.candidates.length()").value(1))
                .andExpect(jsonPath("$.candidates[0].technicianId").value(technician.getId()))
                .andExpect(jsonPath("$.candidates[0].activeCases").value(0));
        availability.deleteById(technician.getId());
        mvc.perform(post(ranking()).with(user(new AppUserDetails(admin))).contentType(MediaType.APPLICATION_JSON).content("{\"mode\":\"STANDARD\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.candidates").isEmpty());
    }
    @Test void rejectsRoleSiteUnknownIdAndMalformedModeAndFallsBackForUnavailableAi() throws Exception {
        mvc.perform(post(ranking()).contentType(MediaType.APPLICATION_JSON).content("{\"mode\":\"AI\"}")).andExpect(status().isUnauthorized());
        mvc.perform(post(ranking()).with(user(new AppUserDetails(reporter))).contentType(MediaType.APPLICATION_JSON).content("{\"mode\":\"AI\"}")).andExpect(status().isForbidden());
        User foreignAdmin = userAccount(UserRole.admin, other);
        mvc.perform(post(ranking()).with(user(new AppUserDetails(foreignAdmin))).contentType(MediaType.APPLICATION_JSON).content("{\"mode\":\"AI\"}")).andExpect(status().isForbidden());
        mvc.perform(post("/api/reports/9223372036854775807/technician-ranking").with(user(new AppUserDetails(admin))).contentType(MediaType.APPLICATION_JSON).content("{\"mode\":\"AI\"}")).andExpect(status().isNotFound());
        mvc.perform(post(ranking()).with(user(new AppUserDetails(admin))).contentType(MediaType.APPLICATION_JSON).content("{\"mode\":\"unknown\"}")).andExpect(status().isBadRequest());
        mvc.perform(post(ranking()).with(user(new AppUserDetails(admin))).contentType(MediaType.APPLICATION_JSON).content("{\"mode\":\"AI\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.methodUsed").value("STANDARD"))
                .andExpect(jsonPath("$.fallbackReason").isNotEmpty());
    }
    @Test void workloadOrdersEqualSkillsAndSpecialtyMustMatch() throws Exception {
        contract(outsider, site); available(outsider);
        Report busy = report(site, reporter); busy.setAssignedTechnician(technician);
        busy.setStatus(ReportStatus.in_progress); reports.save(busy);
        mvc.perform(post(ranking()).with(user(new AppUserDetails(admin))).contentType(MediaType.APPLICATION_JSON).content("{\"mode\":\"STANDARD\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.candidates[0].technicianId").value(outsider.getId()))
                .andExpect(jsonPath("$.candidates[1].activeCases").value(1));
        report.setSpecialty("water supply"); reports.save(report);
        mvc.perform(post(ranking()).with(user(new AppUserDetails(admin))).contentType(MediaType.APPLICATION_JSON).content("{\"mode\":\"STANDARD\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.candidates").isEmpty());
    }
    @Test void assignmentRequiresReportSiteContractAndApprovalMakesTechnicianEligible() throws Exception {
        String path = "/api/reports/" + report.getId() + "/assign";
        contract(outsider, other);
        mvc.perform(post(path).with(user(new AppUserDetails(admin))).contentType(MediaType.APPLICATION_JSON).content("{\"technicianId\":" + outsider.getId() + "}"))
                .andExpect(status().isConflict());
        assertThat(reports.findById(report.getId()).orElseThrow().getAssignedTechnician()).isNull();
        contract(outsider, site);
        mvc.perform(post(path).with(user(new AppUserDetails(admin))).contentType(MediaType.APPLICATION_JSON).content("{\"technicianId\":" + outsider.getId() + "}"))
                .andExpect(status().isOk());
    }
    @Test void invitationsArePrivateIdempotentAndNeverCreateContractsOrAssignments() throws Exception {
        String path = "/api/reports/" + report.getId() + "/technician-invitations";
        mvc.perform(post(path).with(user(new AppUserDetails(reporter))).contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"Please request a site contract\"}"))
                .andExpect(status().isForbidden());
        for (int expected : new int[]{1, 0}) {
            mvc.perform(post(path).with(user(new AppUserDetails(admin))).contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"Please request a site contract\"}"))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.created").value(expected));
        }
        mvc.perform(get("/api/technician-invitations").with(user(new AppUserDetails(outsider))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].siteId").value(site.getId()))
                .andExpect(jsonPath("$.items[0].reportId").doesNotExist());
        mvc.perform(get("/api/technician-invitations").with(user(new AppUserDetails(technician))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items").isEmpty());
        assertThat(contracts.existsByTechnician_IdAndSite_Id(outsider.getId(), site.getId())).isFalse();
        assertThat(reports.findById(report.getId()).orElseThrow().getAssignedTechnician()).isNull();
    }
}
