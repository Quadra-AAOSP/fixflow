package com.example.fixflow.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import com.example.fixflow.domain.*;
import com.example.fixflow.repository.*;

@SpringBootTest
class ApiSecurityMatrixIntegrationTest {
    @Autowired WebApplicationContext context;
    @Autowired SiteRepository sites;
    @Autowired UserRepository users;
    @Autowired ReportRepository reports;
    @Autowired SubsiteRepository subsites;
    @Autowired TechnicianContractRepository contracts;
    @Autowired TechnicianContractApplicationRepository applications;
    @Autowired SubsiteRequestRepository alerts;
    private MockMvc mvc;
    private Site own, other;
    private User reporter, admin, otherAdmin, technician, secondTechnician;
    private Report report, foreignReport;
    private Subsite building, foreignBuilding;

    @BeforeEach void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        own = site("Own"); other = site("Other");
        reporter = account(UserRole.reporter, own); admin = account(UserRole.admin, own);
        otherAdmin = account(UserRole.admin, other); technician = account(UserRole.technician, null);
        secondTechnician = account(UserRole.technician, null);
        report = report(own, reporter); foreignReport = report(other, otherAdmin);
        building = building(own); foreignBuilding = building(other);
    }

    private Site site(String name) {
        Site site = new Site(); site.setName(name); site.setType(SiteType.school);
        site.setContractStatus(ContractStatus.uncontracted); return sites.save(site);
    }
    private User account(UserRole role, Site site) {
        User u = new User(); u.setEmail(role + "-" + System.nanoTime() + "@example.com");
        u.setPasswordHash("unused"); u.setFirstName("Test"); u.setLastName("User"); u.setRole(role); u.setSite(site);
        return users.save(u);
    }
    private Report report(Site site, User creator) {
        Report r = new Report(); r.setSite(site); r.setCreatedBy(creator); r.setDescription("Leaking pipe");
        r.setCategory("plumbing"); r.setReporterUrgency(Urgency.low); r.setAddress("Private room"); return reports.save(r);
    }
    private Subsite building(Site site) {
        Subsite s = new Subsite(); s.setSite(site); s.setLabel("E5"); s.setName("Classroom building"); return subsites.save(s);
    }
    private String creation(Long subsiteId) {
        return "{\"description\":\"Leak\",\"category\":\"plumbing\",\"reporterUrgency\":\"low\",\"subsiteId\":" + subsiteId + "}";
    }
    private TechnicianContractApplication application(User tech, Site site) {
        TechnicianContractApplication a = new TechnicianContractApplication(); a.setTechnician(tech); a.setSite(site);
        return applications.save(a);
    }

    static Stream<String> protectedRoutes() {
        return Stream.of("GET /api/auth/me", "POST /api/auth/logout", "POST /api/admin/users",
                "GET /api/sites", "GET /api/sites/1", "POST /api/sites", "PUT /api/sites/1", "DELETE /api/sites/1",
                "GET /api/site-rules", "POST /api/site-rules", "PUT /api/site-rules/1", "DELETE /api/site-rules/1",
                "GET /api/reports", "POST /api/reports", "GET /api/reports/1", "POST /api/reports/1/join",
                "GET /api/reports/1/reporters", "POST /api/reports/1/assign", "POST /api/technician-contracts",
                "POST /api/technician-skills", "GET /api/technician-contract-requests", "POST /api/technician-contract-requests",
                "POST /api/technician-contract-requests/1/decision", "GET /api/sites/1/subsites", "POST /api/sites/1/subsites",
                "GET /api/sites/1/subsite-requests", "POST /api/sites/1/subsite-requests", "POST /api/sites/1/subsite-requests/1/resolve");
    }

    @ParameterizedTest @MethodSource("protectedRoutes")
    void everyProtectedEndpointRejectsMissingSession(String route) throws Exception {
        String[] parts = route.split(" ", 2);
        mvc.perform(request(HttpMethod.valueOf(parts[0]), parts[1]).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.status").value(401));
    }

    @Test void roleMatrixRejectsPrivilegedMutations() throws Exception {
        String siteBody = "{\"name\":\"X\",\"type\":\"school\",\"contractStatus\":\"uncontracted\"}";
        mvc.perform(post("/api/sites").with(user(new AppUserDetails(reporter))).contentType(MediaType.APPLICATION_JSON).content(siteBody)).andExpect(status().isForbidden());
        mvc.perform(put("/api/sites/" + own.getId()).with(user(new AppUserDetails(reporter))).contentType(MediaType.APPLICATION_JSON).content(siteBody)).andExpect(status().isForbidden());
        mvc.perform(delete("/api/sites/" + own.getId()).with(user(new AppUserDetails(admin)))).andExpect(status().isForbidden());
        mvc.perform(post("/api/admin/users").with(user(new AppUserDetails(reporter))).contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isForbidden());
        mvc.perform(post("/api/reports").with(user(new AppUserDetails(technician))).contentType(MediaType.APPLICATION_JSON).content(creation(building.getId()))).andExpect(status().isForbidden());
        mvc.perform(post("/api/reports/" + report.getId() + "/join").with(user(new AppUserDetails(admin)))).andExpect(status().isForbidden());
        mvc.perform(post("/api/reports/" + report.getId() + "/assign").with(user(new AppUserDetails(reporter))).contentType(MediaType.APPLICATION_JSON).content("{\"technicianId\":" + technician.getId() + "}")).andExpect(status().isForbidden());
        mvc.perform(post("/api/technician-contracts").with(user(new AppUserDetails(reporter))).contentType(MediaType.APPLICATION_JSON).content("{\"technicianId\":" + technician.getId() + ",\"siteId\":" + own.getId() + "}")).andExpect(status().isForbidden());
        mvc.perform(post("/api/sites/" + own.getId() + "/subsites").with(user(new AppUserDetails(reporter))).contentType(MediaType.APPLICATION_JSON).content("{\"label\":\"E6\",\"name\":\"Library\"}")).andExpect(status().isForbidden());
        mvc.perform(get("/api/sites/" + own.getId() + "/subsite-requests").with(user(new AppUserDetails(reporter)))).andExpect(status().isForbidden());
        mvc.perform(post("/api/technician-contract-requests").with(user(new AppUserDetails(reporter))).contentType(MediaType.APPLICATION_JSON).content("{\"siteId\":" + own.getId() + "}")).andExpect(status().isForbidden());
    }

    @Test void siteAndChangedReportIdMatrixRejectsForeignResources() throws Exception {
        for (String path : new String[]{"/api/reports/" + foreignReport.getId(), "/api/reports/" + foreignReport.getId() + "/reporters", "/api/sites/" + other.getId(), "/api/sites/" + other.getId() + "/subsites"}) {
            mvc.perform(get(path).with(user(new AppUserDetails(admin)))).andExpect(status().isForbidden());
        }
        mvc.perform(get("/api/reports").param("siteId", other.getId().toString()).with(user(new AppUserDetails(reporter)))).andExpect(status().isForbidden());
        mvc.perform(post("/api/reports/" + foreignReport.getId() + "/join").with(user(new AppUserDetails(reporter)))).andExpect(status().isForbidden());
        mvc.perform(post("/api/reports/" + foreignReport.getId() + "/assign").with(user(new AppUserDetails(admin))).contentType(MediaType.APPLICATION_JSON).content("{\"technicianId\":" + technician.getId() + "}")).andExpect(status().isForbidden());
        mvc.perform(post("/api/technician-contracts").with(user(new AppUserDetails(admin))).contentType(MediaType.APPLICATION_JSON).content("{\"technicianId\":" + technician.getId() + ",\"siteId\":" + other.getId() + "}")).andExpect(status().isForbidden());
        mvc.perform(post("/api/reports").with(user(new AppUserDetails(reporter))).contentType(MediaType.APPLICATION_JSON).content(creation(foreignBuilding.getId()))).andExpect(status().isBadRequest());
        mvc.perform(get("/api/reports/9223372036854775807").with(user(new AppUserDetails(admin)))).andExpect(status().isNotFound());
    }

    @Test void selectedSubsitePersistsAndIsReturnedOnRead() throws Exception {
        mvc.perform(post("/api/reports").with(user(new AppUserDetails(reporter))).contentType(MediaType.APPLICATION_JSON).content(creation(building.getId())))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.subsiteId").value(building.getId()));
        Report saved = reports.findAll().stream().filter(r -> r.getCreatedBy().getId().equals(reporter.getId()) && r.getSubsite() != null).findFirst().orElseThrow();
        assertThat(saved.getSubsite().getId()).isEqualTo(building.getId());
        mvc.perform(get("/api/reports/" + saved.getId()).with(user(new AppUserDetails(reporter))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.subsiteId").value(building.getId()));
    }

    @Test void contractWorkflowApprovesAtomicallyAndRejectsDuplicateDecision() throws Exception {
        mvc.perform(post("/api/technician-contract-requests").with(user(new AppUserDetails(technician))).contentType(MediaType.APPLICATION_JSON).content("{\"siteId\":" + own.getId() + ",\"note\":\"Available\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.status").value("pending"));
        var a = applications.findByTechnician_IdOrderByCreatedAtDesc(technician.getId()).getFirst();
        assertThat(contracts.existsByTechnician_IdAndSite_Id(technician.getId(), own.getId())).isFalse();
        mvc.perform(post("/api/technician-contract-requests").with(user(new AppUserDetails(technician))).contentType(MediaType.APPLICATION_JSON).content("{\"siteId\":" + own.getId() + "}")).andExpect(status().isConflict());
        mvc.perform(post("/api/technician-contract-requests/" + a.getId() + "/decision").with(user(new AppUserDetails(otherAdmin))).contentType(MediaType.APPLICATION_JSON).content("{\"decision\":\"approve\"}")).andExpect(status().isForbidden());
        mvc.perform(post("/api/technician-contract-requests/" + a.getId() + "/decision").with(user(new AppUserDetails(admin))).contentType(MediaType.APPLICATION_JSON).content("{\"decision\":\"approve\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("approved")).andExpect(jsonPath("$.decidedByUserId").value(admin.getId()));
        assertThat(contracts.existsByTechnician_IdAndSite_Id(technician.getId(), own.getId())).isTrue();
        assertThat(users.findById(technician.getId()).orElseThrow().getSite()).isNull();
        mvc.perform(post("/api/technician-contract-requests/" + a.getId() + "/decision").with(user(new AppUserDetails(admin))).contentType(MediaType.APPLICATION_JSON).content("{\"decision\":\"reject\"}")).andExpect(status().isConflict());
    }

    @Test void rejectionCreatesNoContractAndListsDoNotLeakOtherTechnicians() throws Exception {
        var a = application(technician, own); var foreign = application(secondTechnician, other);
        mvc.perform(post("/api/technician-contract-requests/" + a.getId() + "/decision").with(user(new AppUserDetails(technician))).contentType(MediaType.APPLICATION_JSON).content("{\"decision\":\"approve\"}")).andExpect(status().isForbidden());
        mvc.perform(post("/api/technician-contract-requests/" + a.getId() + "/decision").with(user(new AppUserDetails(admin))).contentType(MediaType.APPLICATION_JSON).content("{\"decision\":\"reject\",\"reason\":\"No vacancies\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("rejected"));
        assertThat(contracts.existsByTechnician_IdAndSite_Id(technician.getId(), own.getId())).isFalse();
        mvc.perform(get("/api/technician-contract-requests").with(user(new AppUserDetails(technician))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].id").value(a.getId()));
        mvc.perform(get("/api/technician-contract-requests").param("siteId", other.getId().toString()).with(user(new AppUserDetails(admin)))).andExpect(status().isForbidden());
        mvc.perform(post("/api/technician-contract-requests/" + foreign.getId() + "/decision").with(user(new AppUserDetails(admin))).contentType(MediaType.APPLICATION_JSON).content("{\"decision\":\"approve\"}")).andExpect(status().isForbidden());
    }

    static Stream<String> malformedReports() {
        return Stream.of("{", "{}", "{\"description\":\" \",\"category\":\"plumbing\",\"reporterUrgency\":\"low\"}",
                "{\"description\":\"Leak\",\"category\":\"unknown\",\"reporterUrgency\":\"low\"}",
                "{\"description\":\"Leak\",\"category\":\"plumbing\",\"reporterUrgency\":\"emergency\"}",
                "{\"description\":\"Leak\",\"category\":\"plumbing\",\"reporterUrgency\":\"low\",\"subsiteId\":-1}",
                "{\"description\":\"" + "x".repeat(10001) + "\",\"category\":\"plumbing\",\"reporterUrgency\":\"low\"}");
    }
    @ParameterizedTest @MethodSource("malformedReports") void malformedInputIsRejectedWithoutWrites(String body) throws Exception {
        long before = reports.count();
        mvc.perform(post("/api/reports").with(user(new AppUserDetails(reporter))).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isBadRequest());
        assertThat(reports.count()).isEqualTo(before);
    }

    @Test void malformedIdsDecisionsAndRequestsAreRejected() throws Exception {
        mvc.perform(get("/api/reports/not-a-number").with(user(new AppUserDetails(admin)))).andExpect(status().isBadRequest());
        mvc.perform(post("/api/technician-contract-requests").with(user(new AppUserDetails(technician))).contentType(MediaType.APPLICATION_JSON).content("{\"siteId\":-1}")).andExpect(status().isBadRequest());
        mvc.perform(post("/api/technician-contract-requests/1/decision").with(user(new AppUserDetails(admin))).contentType(MediaType.APPLICATION_JSON).content("{\"decision\":\"pending\"}")).andExpect(status().isBadRequest());
    }

    @ParameterizedTest @EnumSource(value = UserRole.class, names = {"reporter", "technician", "staff", "super_admin"})
    void onlyTargetSiteAdminCanDecide(UserRole role) throws Exception {
        User actor = account(role, role == UserRole.super_admin || role == UserRole.technician ? null : own);
        var pending = application(technician, own);
        mvc.perform(post("/api/technician-contract-requests/" + pending.getId() + "/decision")
                .with(user(new AppUserDetails(actor))).contentType(MediaType.APPLICATION_JSON)
                .content("{\"decision\":\"approve\"}")).andExpect(status().isForbidden());
        assertThat(applications.findById(pending.getId()).orElseThrow().getStatus()).isEqualTo(TechnicianContractApplication.Status.pending);
        assertThat(contracts.existsByTechnician_IdAndSite_Id(technician.getId(), own.getId())).isFalse();
    }

    @Test void taxonomyAndSkillsRejectWrongRoleAndChangedTechnicianId() throws Exception {
        String rule = "{\"siteType\":\"school\",\"category\":\"general\",\"urgencyWeight\":0,\"sortOrder\":0}";
        for (UserRole role : new UserRole[]{UserRole.reporter, UserRole.technician, UserRole.staff}) {
            var actor = user(new AppUserDetails(account(role, role == UserRole.technician ? null : own)));
            mvc.perform(post("/api/site-rules").with(actor).contentType(MediaType.APPLICATION_JSON).content(rule)).andExpect(status().isForbidden());
            mvc.perform(put("/api/site-rules/1").with(actor).contentType(MediaType.APPLICATION_JSON).content(rule)).andExpect(status().isForbidden());
            mvc.perform(delete("/api/site-rules/1").with(actor)).andExpect(status().isForbidden());
        }
        String skill = "{\"technicianId\":" + secondTechnician.getId() + ",\"category\":\"plumbing\",\"proficiency\":3}";
        for (User actor : new User[]{technician, reporter, admin}) {
            mvc.perform(post("/api/technician-skills").with(user(new AppUserDetails(actor))).contentType(MediaType.APPLICATION_JSON).content(skill)).andExpect(status().isForbidden());
        }
        TechnicianContract contract = new TechnicianContract(); contract.setTechnician(secondTechnician); contract.setSite(own); contracts.save(contract);
        mvc.perform(post("/api/technician-skills").with(user(new AppUserDetails(admin))).contentType(MediaType.APPLICATION_JSON).content(skill)).andExpect(status().isCreated());
        mvc.perform(post("/api/technician-skills").with(user(new AppUserDetails(otherAdmin))).contentType(MediaType.APPLICATION_JSON).content(skill)).andExpect(status().isForbidden());
    }

    @Test void subsiteAlertMatrixEnforcesRoleSiteAndChangedAlertId() throws Exception {
        Site empty = site("Empty"); User emptyReporter = account(UserRole.reporter, empty); User emptyAdmin = account(UserRole.admin, empty);
        mvc.perform(post("/api/sites/" + empty.getId() + "/subsite-requests").with(user(new AppUserDetails(reporter))).contentType(MediaType.APPLICATION_JSON).content("{\"note\":\"Add buildings\"}")).andExpect(status().isForbidden());
        mvc.perform(post("/api/sites/" + empty.getId() + "/subsite-requests").with(user(new AppUserDetails(emptyReporter))).contentType(MediaType.APPLICATION_JSON).content("{\"note\":\"Add buildings\"}")).andExpect(status().isCreated());
        mvc.perform(post("/api/sites/" + empty.getId() + "/subsite-requests").with(user(new AppUserDetails(emptyReporter))).contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isConflict());
        var alert = alerts.findBySite_IdAndStatusOrderByCreatedAtAsc(empty.getId(), com.example.fixflow.domain.SubsiteRequest.Status.pending).getFirst();
        String resolve = "/api/sites/" + empty.getId() + "/subsite-requests/" + alert.getId() + "/resolve";
        mvc.perform(post(resolve).with(user(new AppUserDetails(emptyReporter)))).andExpect(status().isForbidden());
        mvc.perform(post(resolve).with(user(new AppUserDetails(admin)))).andExpect(status().isForbidden());
        mvc.perform(post("/api/sites/" + own.getId() + "/subsite-requests/" + alert.getId() + "/resolve").with(user(new AppUserDetails(admin)))).andExpect(status().isNotFound());
        mvc.perform(post(resolve).with(user(new AppUserDetails(emptyAdmin)))).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("resolved"));
        mvc.perform(post("/api/sites/" + other.getId() + "/subsites").with(user(new AppUserDetails(admin))).contentType(MediaType.APPLICATION_JSON).content("{\"label\":\"E6\",\"name\":\"Library\"}")).andExpect(status().isForbidden());
    }

    @Test void malformedBodyMatrixCoversAllJsonWriteContracts() throws Exception {
        for (String endpoint : new String[]{"/api/sites", "/api/site-rules", "/api/technician-contracts", "/api/technician-skills", "/api/admin/users", "/api/sites/" + own.getId() + "/subsites", "/api/technician-contract-requests", "/api/technician-contract-requests/1/decision", "/api/reports/" + report.getId() + "/assign"}) {
            for (String body : new String[]{"{", "{}"}) {
                mvc.perform(post(endpoint).with(user(new AppUserDetails(admin))).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isBadRequest());
            }
        }
        for (String endpoint : new String[]{"/api/auth/login", "/api/auth/register"}) {
            mvc.perform(post(endpoint).contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isBadRequest());
        }
    }

    @Test void missingOrUnselectedSubsiteAndTechnicianRegistration() throws Exception {
        mvc.perform(post("/api/reports").with(user(new AppUserDetails(reporter))).contentType(MediaType.APPLICATION_JSON).content(creation(Long.MAX_VALUE))).andExpect(status().isBadRequest());
        mvc.perform(post("/api/reports").with(user(new AppUserDetails(reporter))).contentType(MediaType.APPLICATION_JSON).content(creation(null)))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.subsiteId").isEmpty());
        String registration = "{\"email\":\"tech-" + System.nanoTime() + "@example.com\",\"password\":\"password123\",\"firstName\":\"Tech\",\"lastName\":\"Test\",\"role\":\"technician\",\"siteId\":";
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(registration + own.getId() + "}")).andExpect(status().isBadRequest());
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(registration + "null}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.siteId").isEmpty());
    }

    @Test void uploadAbuseIsRejectedWithoutCreatingReports() throws Exception {
        long before = reports.count();
        for (MockMultipartFile file : new MockMultipartFile[]{
                new MockMultipartFile("file", "../../payload.html", "text/html", "<script>alert(1)</script>".getBytes()),
                new MockMultipartFile("file", "oversize.jpg", "image/jpeg", new byte[5 * 1024 * 1024 + 1])}) {
            mvc.perform(multipart("/api/reports").file(file).with(user(new AppUserDetails(reporter)))).andExpect(status().isUnsupportedMediaType());
        }
        var excessive = multipart("/api/reports");
        for (int i = 0; i < 6; i++) excessive.file(new MockMultipartFile("file", "photo.jpg", "image/jpeg", new byte[]{1}));
        mvc.perform(excessive.with(user(new AppUserDetails(reporter)))).andExpect(status().isUnsupportedMediaType());
        mvc.perform(multipart("/api/reports/" + foreignReport.getId() + "/photos").file(new MockMultipartFile("file", "x.jpg", "image/jpeg", new byte[]{1})).with(user(new AppUserDetails(reporter)))).andExpect(status().isNotFound());
        assertThat(reports.count()).isEqualTo(before);
    }
}
