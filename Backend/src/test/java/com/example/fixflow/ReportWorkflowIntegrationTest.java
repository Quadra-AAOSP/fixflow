package com.example.fixflow;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.example.fixflow.domain.*;
import com.example.fixflow.repository.*;
import com.example.fixflow.security.AppUserDetails;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest(properties = {"fixflow.technician-terms.version=test-v1", "fixflow.technician-terms.document-url=https://example.test/terms"})
class ReportWorkflowIntegrationTest {
    @Autowired TechnicianTermsAcceptanceRepository termsFixture;
    @Autowired SiteTechnicianVettingRepository vettingFixture;
    @Autowired TechnicianVerificationRepository verificationFixture;
    @Autowired WebApplicationContext context;
    @Autowired SiteRepository sites;
    @Autowired UserRepository users;
    @Autowired ReportRepository reports;
    @Autowired TechnicianContractRepository contracts;
    @Autowired ReportResolutionRepository resolutions;
    @Autowired ReportNotificationRepository notifications;
    @Autowired com.example.fixflow.service.ReportWorkflowService workflow;
    @Autowired org.springframework.transaction.PlatformTransactionManager transactions;
    MockMvc mvc;
    User admin, reporter, technician;
    Report report;

    @BeforeEach void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity())
                .defaultRequest(get("/").with(csrf())).build();
        Site site = new Site(); site.setName("Workflow " + System.nanoTime());
        site.setType(SiteType.school); site.setContractStatus(ContractStatus.contracted); site = sites.save(site);
        admin = account(UserRole.admin, site); reporter = account(UserRole.reporter, site);
        technician = account(UserRole.technician, null);
        VettingFixture.eligible(technician, site, admin, termsFixture, verificationFixture, vettingFixture);
        TechnicianContract contract = new TechnicianContract(); contract.setSite(site); contract.setTechnician(technician);
        contracts.save(contract);
        report = new Report(); report.setSite(site); report.setCreatedBy(reporter);
        report.setDescription("Workflow issue"); report.setCategory("plumbing"); report.setReporterUrgency(Urgency.medium);
        report = reports.save(report);
    }

    User account(UserRole role, Site site) {
        User value = new User(); value.setEmail("workflow-" + System.nanoTime() + "@example.test");
        value.setPasswordHash("test-only"); value.setFirstName("Workflow"); value.setLastName("Test");
        value.setRole(role); value.setSite(site); return users.save(value);
    }

    @Test void reviewApiScopesWritesAndExposesCurrentStatusToTechnician() throws Exception {
        String path="/api/sites/" + report.getSite().getId() + "/technicians/" + technician.getId() + "/vetting";
        mvc.perform(get(path).with(user(new AppUserDetails(technician)))).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("approved"));
        String revoked="{\"status\":\"revoked\",\"identityChecked\":false,\"referencesChecked\":false,\"qualificationsChecked\":false,\"licenceApplicable\":false,\"licenceChecked\":false,\"insuranceApplicable\":false,\"insuranceChecked\":false}";
        mvc.perform(post(path).with(user(new AppUserDetails(reporter))).contentType(MediaType.APPLICATION_JSON).content(revoked)).andExpect(status().isForbidden());
        mvc.perform(post(path).with(user(new AppUserDetails(admin))).contentType(MediaType.APPLICATION_JSON).content(revoked)).andExpect(status().isOk());
        mvc.perform(get(path).with(user(new AppUserDetails(technician)))).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("revoked"));
    }
    @Test void revokedSiteReviewBlocksClaimAndExpiredReviewBlocksStart() throws Exception {
        var latest=vettingFixture.findFirstBySiteIdAndTechnicianIdOrderByIdDesc(report.getSite().getId(), technician.getId()).orElseThrow();
        latest.setStatus("revoked"); vettingFixture.saveAndFlush(latest);
        String base="/api/reports/" + report.getId();
        mvc.perform(post(base + "/claim").with(user(new AppUserDetails(technician)))).andExpect(status().isConflict());
        latest.setStatus("approved"); latest.setExpiresAt(java.time.Instant.now().minusSeconds(1)); vettingFixture.saveAndFlush(latest);
        report.setAssignedTechnician(technician); report.setStatus(ReportStatus.assigned); reports.saveAndFlush(report);
        mvc.perform(post(base + "/start").with(user(new AppUserDetails(technician)))).andExpect(status().isConflict());
    }
    @Test void claimStartResolveAndReadHistory() throws Exception {
        String base = "/api/reports/" + report.getId();
        mvc.perform(post(base + "/claim").with(user(new AppUserDetails(technician))))
                .andExpect(status().isOk()).andExpect(jsonPath("status").value("assigned"));
        mvc.perform(post(base + "/start").with(user(new AppUserDetails(technician))))
                .andExpect(status().isOk()).andExpect(jsonPath("status").value("in_progress"));
        mvc.perform(post(base + "/resolve").with(user(new AppUserDetails(technician)))
                .contentType(MediaType.APPLICATION_JSON).content("{\"description\":\"Replaced damaged pipe\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("status").value("resolved_pending_confirmation"));
        mvc.perform(get("/api/notifications").with(user(new AppUserDetails(reporter))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content[0].type").value("work_completed"))
                .andExpect(jsonPath("$.content[0].reportId").value(report.getId()));
        mvc.perform(get("/api/notifications").with(user(new AppUserDetails(admin))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content.length()").value(0));
        mvc.perform(get(base + "/history").with(user(new AppUserDetails(reporter))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(3));
    }

    @Test void rolledBackResolutionDoesNotNotify() {
        report.setAssignedTechnician(technician); report.setStatus(ReportStatus.in_progress); reports.save(report);
        new org.springframework.transaction.support.TransactionTemplate(transactions).executeWithoutResult(tx -> {
            workflow.resolve(report.getId(), "Repair", new AppUserDetails(technician));
            tx.setRollbackOnly();
        });
        org.assertj.core.api.Assertions.assertThat(notifications.findByRecipientIdOrderByIdDesc(reporter.getId(),
                org.springframework.data.domain.PageRequest.of(0, 20)).getContent()).isEmpty();
        org.assertj.core.api.Assertions.assertThat(resolutions.findByReport_IdOrderByIdAsc(report.getId())).isEmpty();
    }

    @Test void reporterCannotClaimAndUnassignedTechnicianCannotStart() throws Exception {
        String base = "/api/reports/" + report.getId();
        mvc.perform(post(base + "/claim").with(user(new AppUserDetails(reporter)))).andExpect(status().isForbidden());
        mvc.perform(post(base + "/start").with(user(new AppUserDetails(technician)))).andExpect(status().isForbidden());
    }

    @Test void urgencyOverridePreservesReporterUrgency() throws Exception {
        mvc.perform(patch("/api/reports/" + report.getId() + "/urgency").with(user(new AppUserDetails(admin)))
                .contentType(MediaType.APPLICATION_JSON).content("{\"urgency\":\"critical\",\"reason\":\"Immediate hazard\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("finalUrgency").value("critical"))
                .andExpect(jsonPath("reporterUrgency").value("medium"));
    }

    @Test void ratingRequiresConfirmedResolutionAndRejectsDuplicateAndSelfRating() throws Exception {
        report.setAssignedTechnician(technician); report.setStatus(ReportStatus.in_progress); reports.save(report);
        String base="/api/reports/"+report.getId();
        mvc.perform(post(base+"/resolve").with(user(new AppUserDetails(technician)))
                .contentType(MediaType.APPLICATION_JSON).content("{\"description\":\"Pipe repaired\"}"))
                .andExpect(status().isOk());
        Long resolution=resolutions.findByReport_IdOrderByIdAsc(report.getId()).getFirst().getId();
        String rating="{\"resolutionId\":"+resolution+",\"score\":5,\"feedback\":\"Repair worked\"}";
        mvc.perform(post(base+"/ratings").with(user(new AppUserDetails(reporter)))
                .contentType(MediaType.APPLICATION_JSON).content(rating)).andExpect(status().isConflict());
        mvc.perform(post(base+"/confirm").contentType(MediaType.APPLICATION_JSON).content("{\"signedName\":\"Reporter\"}").with(user(new AppUserDetails(reporter)))).andExpect(status().isOk());
        mvc.perform(post(base+"/ratings").with(user(new AppUserDetails(reporter)))
                .contentType(MediaType.APPLICATION_JSON).content(rating)).andExpect(status().isOk())
                .andExpect(jsonPath("score").value(5));
        mvc.perform(post(base+"/ratings").with(user(new AppUserDetails(reporter)))
                .contentType(MediaType.APPLICATION_JSON).content(rating)).andExpect(status().isConflict());
        mvc.perform(post(base+"/ratings").with(user(new AppUserDetails(technician)))
                .contentType(MediaType.APPLICATION_JSON).content(rating)).andExpect(status().isForbidden());
        mvc.perform(get(base+"/resolutions").with(user(new AppUserDetails(admin))))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].technicianId").value(technician.getId()));
        mvc.perform(get(base+"/ratings").with(user(new AppUserDetails(admin))))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].feedback").value("Repair worked"));
    }

    @Test void linksRejectSelfDuplicateAndForeignSite() throws Exception {
        Report target=new Report(); target.setSite(report.getSite()); target.setCreatedBy(reporter);
        target.setDescription("Related issue"); target.setCategory("plumbing"); target.setReporterUrgency(Urgency.low);
        target=reports.save(target);
        String base="/api/reports/"+report.getId()+"/links";
        String body="{\"linkedReportId\":"+target.getId()+",\"reason\":\"Same damaged pipe\"}";
        mvc.perform(post(base).with(user(new AppUserDetails(admin))).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk());
        mvc.perform(post(base).with(user(new AppUserDetails(admin))).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isConflict());
        mvc.perform(post(base).with(user(new AppUserDetails(admin))).contentType(MediaType.APPLICATION_JSON)
                .content("{\"linkedReportId\":"+report.getId()+",\"reason\":\"Self\"}")).andExpect(status().isConflict());
        mvc.perform(get("/api/reports/"+target.getId()+"/links").with(user(new AppUserDetails(reporter))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
        Site foreign=new Site(); foreign.setName("Foreign "+System.nanoTime()); foreign.setType(SiteType.school);
        foreign.setContractStatus(ContractStatus.contracted); foreign=sites.save(foreign);
        User foreignAdmin=account(UserRole.admin,foreign);
        mvc.perform(get(base).with(user(new AppUserDetails(foreignAdmin)))).andExpect(status().isForbidden());
        mvc.perform(post(base).with(user(new AppUserDetails(foreignAdmin))).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isForbidden());
    }

    @Test void escalationAndValidationEnforceStateAndRole() throws Exception {
        String base="/api/reports/"+report.getId();
        mvc.perform(post(base+"/escalate").with(user(new AppUserDetails(reporter)))
                .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"Hazard\"}")).andExpect(status().isForbidden());
        mvc.perform(post(base+"/escalate").with(user(new AppUserDetails(admin)))
                .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\" \"}")).andExpect(status().isBadRequest());
        mvc.perform(post(base+"/escalate").with(user(new AppUserDetails(admin)))
                .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"Urgent specialist needed\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("status").value("escalated"));
        mvc.perform(get(base+"/history").with(user(new AppUserDetails(admin))))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].note").value("Urgent specialist needed"));
        mvc.perform(patch(base+"/urgency").with(user(new AppUserDetails(reporter)))
                .contentType(MediaType.APPLICATION_JSON).content("{\"urgency\":\"high\",\"reason\":\"Hazard\"}"))
                .andExpect(status().isForbidden());
    }

    @Test void simultaneousClaimsHaveOneWinner() throws Exception {
        User other=account(UserRole.technician,null);
        TechnicianContract contract=new TechnicianContract(); contract.setSite(report.getSite());
        contract.setTechnician(other); contracts.save(contract);
        var ready=new java.util.concurrent.CountDownLatch(2);
        var start=new java.util.concurrent.CountDownLatch(1);
        try(var executor=java.util.concurrent.Executors.newFixedThreadPool(2)) {
            var jobs=new java.util.ArrayList<java.util.concurrent.Future<Integer>>();
            for(User actor:java.util.List.of(technician,other)) jobs.add(executor.submit(()->{
                ready.countDown(); start.await();
                return mvc.perform(post("/api/reports/"+report.getId()+"/claim")
                        .with(user(new AppUserDetails(actor)))).andReturn().getResponse().getStatus();
            }));
            org.junit.jupiter.api.Assertions.assertTrue(ready.await(10,java.util.concurrent.TimeUnit.SECONDS));
            start.countDown();
            var results=new java.util.ArrayList<Integer>();
            for(var job:jobs) results.add(job.get(20,java.util.concurrent.TimeUnit.SECONDS));
            results.sort(Integer::compareTo);
            org.junit.jupiter.api.Assertions.assertEquals(java.util.List.of(200,409),results);
        }
    }

    @Test void privateLinkedReportIsHiddenFromUnattachedReporter() throws Exception {
        Report target=new Report(); target.setSite(report.getSite()); target.setCreatedBy(admin);
        target.setDescription("Private follow-up"); target.setCategory("plumbing");
        target.setReporterUrgency(Urgency.low); target.setVisibility(ReportVisibility.PRIVATE);
        target=reports.save(target);
        mvc.perform(post("/api/reports/"+report.getId()+"/links").with(user(new AppUserDetails(admin)))
                .contentType(MediaType.APPLICATION_JSON).content("{\"linkedReportId\":"+target.getId()+",\"reason\":\"Internal follow-up\"}"))
                .andExpect(status().isOk());
        mvc.perform(get("/api/reports/"+report.getId()+"/links").with(user(new AppUserDetails(reporter))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
    }
}
