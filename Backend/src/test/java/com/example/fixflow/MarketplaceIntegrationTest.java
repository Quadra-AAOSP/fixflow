package com.example.fixflow;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.example.fixflow.domain.*;
import com.example.fixflow.repository.*;
import com.example.fixflow.security.AppUserDetails;
import com.jayway.jsonpath.JsonPath;
import java.time.Instant;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest(properties = {"fixflow.technician-terms.version=test-v1", "fixflow.technician-terms.document-url=https://example.test/terms"})
class MarketplaceIntegrationTest {
    private static final String LISTINGS = "/api/marketplace/listings";
    private static final String APPLICATION = "{\"note\":\"Available tomorrow\"}";
    private static final String SELECT = "{\"safetyConfirmed\":true}";
    @Autowired TechnicianTermsAcceptanceRepository termsFixture;
    @Autowired SiteTechnicianVettingRepository vettingFixture;
    @Autowired WebApplicationContext context;
    @Autowired SiteRepository sites;
    @Autowired UserRepository users;
    @Autowired ReportRepository reports;
    @Autowired ReportReporterRepository participants;
    @Autowired MarketplaceApplicationRepository applications;
    @Autowired TechnicianVerificationRepository verification;
    @Autowired TechnicianContractRepository contracts;
    @Autowired ReportResolutionRepository resolutions;
    @Autowired ReportPhotoRepository photos;
    @Autowired com.example.fixflow.service.ObjectStorageService storage;
    MockMvc mvc;
    User admin, foreign, technician, other, reporter;
    Report report;

    @BeforeEach void prepare() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        Site site = site();
        admin = account(UserRole.admin, site);
        foreign = account(UserRole.admin, site());
        reporter = account(UserRole.reporter, site);
        technician = verifiedTechnician();
        VettingFixture.eligible(technician, site, admin, termsFixture, verification, vettingFixture);
        other = account(UserRole.technician, null);
        report = new Report();
        report.setSite(site);
        report.setCreatedBy(reporter);
        report.setDescription("Confidential private report");
        report.setAddress("Confidential exact room");
        report.setVisibility(ReportVisibility.PRIVATE);
        report.setCategory("plumbing");
        report.setSpecialty("Confidential specialty sentinel");
        report.setReporterUrgency(Urgency.medium);
        report = reports.save(report);
        var participant = new ReportReporter(); participant.setReportId(report.getId()); participant.setUserId(reporter.getId()); participants.save(participant);
    }

    @Test void listingDoesNotGrantReportAccessUntilVerifiedTechnicianAccepts() throws Exception {
        String reportUrl = "/api/reports/" + report.getId();
        mvc.perform(get(LISTINGS)).andExpect(status().isUnauthorized());
        postJson(LISTINGS, foreign, publication()).andExpect(status().isForbidden());
        String listing = LISTINGS + "/" + publish();
        // Open listings are visible to every technician; applying is what
        // requires verification, accepted terms and a matching skill.
        mvc.perform(get(LISTINGS).with(as(other))).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
        mvc.perform(get(LISTINGS).with(as(technician))).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].summary").value("Repair fixture"))
                .andExpect(jsonPath("$[0].reportId").doesNotExist())
                .andExpect(jsonPath("$[0].specialty").doesNotExist())
                .andExpect(jsonPath("$[0].address").doesNotExist())
                .andExpect(jsonPath("$[0].description").doesNotExist());
        postJson(listing + "/applications", other, APPLICATION).andExpect(status().isForbidden());
        String application = listing + "/applications/" + apply(listing, technician);
        postJson(listing + "/applications", technician, APPLICATION).andExpect(status().isConflict());
        mvc.perform(get(listing + "/applications").with(as(foreign))).andExpect(status().isForbidden());
        postJson(application + "/select", admin, "{\"safetyConfirmed\":false}").andExpect(status().isConflict());
        postJson(application + "/select", admin, SELECT).andExpect(status().isOk())
                .andExpect(jsonPath("status").value("offered"));
        assertNull(reports.findById(report.getId()).orElseThrow().getAssignedTechnician());
        mvc.perform(get(reportUrl).with(as(technician))).andExpect(status().isForbidden());
        mvc.perform(get(reportUrl + "/photos").with(as(technician))).andExpect(status().isForbidden());
        postJson(application + "/accept", other, null).andExpect(status().isForbidden());
        postJson(application + "/accept", technician, null).andExpect(status().isOk())
                .andExpect(jsonPath("status").value("accepted"));
        assertFalse(contracts.existsByTechnician_IdAndSite_Id(technician.getId(), report.getSite().getId()));
        mvc.perform(get(reportUrl).with(as(technician))).andExpect(status().isOk())
                .andExpect(jsonPath("description").value("Confidential private report"));
        mvc.perform(get(reportUrl + "/photos").with(as(technician))).andExpect(status().isOk());
        mvc.perform(get(reportUrl + "/reporters").with(as(technician))).andExpect(status().isOk());
        mvc.perform(get("/api/reports").param("siteId", report.getSite().getId().toString()).with(as(technician)))
                .andExpect(status().isForbidden());
        postJson(reportUrl + "/start", technician, null).andExpect(status().isOk());
        postJson(reportUrl + "/resolve", technician, "{\"description\":\"Repaired fixture\"}").andExpect(status().isOk());
        postJson(reportUrl + "/confirm", reporter, "{\"signedName\":\"Admin\"}").andExpect(status().isOk());
        Long resolution = resolutions.findByReport_IdOrderByIdAsc(report.getId()).getFirst().getId();
        postJson(reportUrl + "/ratings", admin, "{\"resolutionId\":" + resolution + ",\"score\":5}")
                .andExpect(status().isOk()).andExpect(jsonPath("ratedByCurrentUser").value(true));
        mvc.perform(get(listing + "/applications").with(as(admin))).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].completedJobs").value(1)).andExpect(jsonPath("$[0].averageRating").value(5.0));
        var reassigned = reports.findById(report.getId()).orElseThrow();
        reassigned.setAssignedTechnician(other);
        reports.save(reassigned);
        mvc.perform(get(reportUrl).with(as(technician))).andExpect(status().isForbidden());
        mvc.perform(get(reportUrl + "/photos").with(as(technician))).andExpect(status().isForbidden());
        mvc.perform(get(reportUrl + "/reporters").with(as(technician))).andExpect(status().isForbidden());
    }

    @Test void expiredOfferCannotActivateAndNextApplicantCanBeSelected() throws Exception {
        User next = verifiedTechnician();
        VettingFixture.eligible(next, report.getSite(), admin, termsFixture, verification, vettingFixture);
        String listing = LISTINGS + "/" + publish();
        int firstId = apply(listing, technician);
        String first = listing + "/applications/" + firstId;
        String second = listing + "/applications/" + apply(listing, next);
        postJson(first + "/select", admin, SELECT).andExpect(status().isOk());
        var expired = applications.findById((long) firstId).orElseThrow();
        expired.setOfferExpiresAt(Instant.now().minusSeconds(2));
        applications.save(expired);
        postJson(first + "/accept", technician, null).andExpect(status().isConflict());
        postJson(second + "/select", admin, SELECT).andExpect(status().isOk());
        assertEquals(MarketplaceApplication.Status.expired, applications.findById((long) firstId).orElseThrow().getStatus());
    }

    @Test void concurrentSelectionsHaveOneWinnerAndSuspensionPreventsAcceptance() throws Exception {
        User next = verifiedTechnician();
        VettingFixture.eligible(next, report.getSite(), admin, termsFixture, verification, vettingFixture);
        String listing = LISTINGS + "/" + publish();
        String first = listing + "/applications/" + apply(listing, technician);
        String second = listing + "/applications/" + apply(listing, next);
        CountDownLatch start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var a = executor.submit(() -> { start.await(); return selectionStatus(first); });
            var b = executor.submit(() -> { start.await(); return selectionStatus(second); });
            start.countDown();
            int statusA = a.get(10, TimeUnit.SECONDS);
            int statusB = b.get(10, TimeUnit.SECONDS);
            assertEquals(200, Math.min(statusA, statusB));
            assertEquals(409, Math.max(statusA, statusB));
            User selected = statusA == 200 ? technician : next;
            var record = verification.findById(selected.getId()).orElseThrow();
            record.setStatus("suspended");
            verification.save(record);
            postJson((statusA == 200 ? first : second) + "/accept", selected, null).andExpect(status().isForbidden());
            assertNull(reports.findById(report.getId()).orElseThrow().getAssignedTechnician());
        }
    }

    @Test void reclassificationClosesTheOfferAndPreventsAcceptance() throws Exception {
        String listing = LISTINGS + "/" + publish();
        String application = listing + "/applications/" + apply(listing, technician);
        postJson(application + "/select", admin, SELECT).andExpect(status().isOk());
        report.setCategory("electrical");
        reports.save(report);
        postJson(application + "/accept", technician, null).andExpect(status().isConflict());
        mvc.perform(get(LISTINGS).with(as(admin))).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].status").value("closed"));
    }

    @Test void siteAdminCanCancelAnActiveAwardAndRepublish() throws Exception {
        String listing = LISTINGS + "/" + publish();
        String application = listing + "/applications/" + apply(listing, technician);
        postJson(application + "/select", admin, SELECT).andExpect(status().isOk());
        postJson(application + "/accept", technician, null).andExpect(status().isOk());
        String reason = "{\"reason\":\"Site access withdrawn\"}";
        postJson(listing + "/cancel-assignment", foreign, reason).andExpect(status().isForbidden());
        postJson(listing + "/cancel-assignment", admin, reason).andExpect(status().isOk())
                .andExpect(jsonPath("status").value("closed"));
        mvc.perform(get(listing + "/applications").with(as(admin))).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].status").value("cancelled"))
                .andExpect(jsonPath("$[0].cancellations").value(1));
        String reportUrl = "/api/reports/" + report.getId();
        mvc.perform(get(reportUrl).with(as(technician))).andExpect(status().isForbidden());
        mvc.perform(get(reportUrl + "/photos").with(as(technician))).andExpect(status().isForbidden());
        mvc.perform(get(reportUrl + "/history").with(as(admin))).andExpect(status().isOk())
                .andExpect(jsonPath("$[1].note").value("Marketplace assignment cancelled: Site access withdrawn"));
        assertNotEquals(listing, LISTINGS + "/" + publish());
    }

    @Test void awardedTechnicianPhotoStreamRequiresCurrentAssignment() throws Exception {
        byte[] bytes = "synthetic photo bytes".getBytes(java.nio.charset.StandardCharsets.UTF_8);
        String key = "test/marketplace-" + report.getId();
        storage.putObject(key, new java.io.ByteArrayInputStream(bytes), bytes.length, "image/png");
        var photo = new ReportPhoto();
        photo.setReport(report);
        photo.setObjectKey(key);
        photo.setContentType("image/png");
        photo.setFileSizeBytes(bytes.length);
        photo = photos.save(photo);
        String listing = LISTINGS + "/" + publish();
        String application = listing + "/applications/" + apply(listing, technician);
        postJson(application + "/select", admin, SELECT).andExpect(status().isOk());
        String url = "/api/reports/" + report.getId() + "/photos/" + photo.getId() + "/content";
        mvc.perform(get(url).with(as(technician))).andExpect(status().isForbidden());
        postJson(application + "/accept", technician, null).andExpect(status().isOk());
        mvc.perform(get("/api/reports/" + report.getId() + "/photos").with(as(technician)))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].url").value(url));
        mvc.perform(get(url).with(as(technician))).andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(content().bytes(bytes));
        postJson(listing + "/cancel-assignment", admin, "{\"reason\":\"Site access withdrawn\"}")
                .andExpect(status().isOk());
        mvc.perform(get(url).with(as(technician))).andExpect(status().isForbidden());
    }
    @Test void ordinaryReassignmentRetiresMarketplaceAwardEvenForSameTechnician() throws Exception {
        String listing = LISTINGS + "/" + publish();
        String application = listing + "/applications/" + apply(listing, technician);
        postJson(application + "/select", admin, SELECT).andExpect(status().isOk());
        postJson(application + "/accept", technician, null).andExpect(status().isOk());
        var contract = new TechnicianContract();
        contract.setSite(report.getSite());
        contract.setTechnician(technician);
        contracts.save(contract);
        postJson("/api/reports/" + report.getId() + "/assign", admin,
                "{\"technicianId\":" + technician.getId() + "}").andExpect(status().isOk());
        mvc.perform(get(listing + "/applications").with(as(admin))).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].status").value("cancelled"));
        postJson(listing + "/cancel-assignment", admin, "{\"reason\":\"Stale award\"}")
                .andExpect(status().isConflict());
        assertEquals(technician.getId(), reports.findById(report.getId()).orElseThrow().getAssignedTechnician().getId());
    }
    @Test void aContractedClaimPreventsAcceptingTheMarketplaceOffer() throws Exception {
        VettingFixture.eligible(other, report.getSite(), admin, termsFixture, verification, vettingFixture);
        var contract = new TechnicianContract();
        contract.setSite(report.getSite());
        contract.setTechnician(other);
        contracts.save(contract);
        String listing = LISTINGS + "/" + publish();
        String application = listing + "/applications/" + apply(listing, technician);
        postJson(application + "/select", admin, SELECT).andExpect(status().isOk());
        postJson("/api/reports/" + report.getId() + "/claim", other, null).andExpect(status().isOk());
        postJson(application + "/accept", technician, null).andExpect(status().isConflict());
        assertEquals(other.getId(), reports.findById(report.getId()).orElseThrow().getAssignedTechnician().getId());
    }

    private int selectionStatus(String application) throws Exception {
        return postJson(application + "/select", admin, SELECT).andReturn().getResponse().getStatus();
    }

    private int publish() throws Exception {
        return JsonPath.read(postJson(LISTINGS, admin, publication()).andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString(), "$.id");
    }

    private int apply(String listing, User actor) throws Exception {
        return JsonPath.read(postJson(listing + "/applications", actor, APPLICATION).andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString(), "$.id");
    }

    private String publication() {
        return """
                {"reportId":%d,"summary":"Repair fixture","broadLocation":"North district","timing":"Tomorrow"}
                """.formatted(report.getId());
    }

    private ResultActions postJson(String path, User actor, String json) throws Exception {
        MockHttpServletRequestBuilder request = post(path).with(csrf()).with(as(actor));
        if (json != null) request.contentType(MediaType.APPLICATION_JSON).content(json);
        return mvc.perform(request);
    }

    private RequestPostProcessor as(User actor) {
        return user(new AppUserDetails(actor));
    }

    private Site site() {
        Site site = new Site();
        site.setName("Marketplace " + System.nanoTime());
        site.setType(SiteType.school);
        site.setContractStatus(ContractStatus.contracted);
        return sites.save(site);
    }

    private User account(UserRole role, Site site) {
        User account = new User();
        account.setEmail("marketplace-" + System.nanoTime() + "@example.test");
        account.setPasswordHash("test-only");
        account.setFirstName("Marketplace");
        account.setLastName("Test");
        account.setRole(role);
        account.setSite(site);
        return users.save(account);
    }

    private User verifiedTechnician() {
        User account = account(UserRole.technician, null);
        TechnicianVerification record = new TechnicianVerification();
        record.setTechnicianId(account.getId());
        record.setStatus("verified");
        record.setTrades("Plumbing");
        record.setIdentityChecked(true);
        record.setEmailChecked(true);
        record.setPhoneChecked(true);
        record.setTradeChecked(true);
        verification.save(record);
        return account;
    }
}

