package com.example.fixflow.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import com.example.fixflow.ai.dto.VisionClassificationResponse;
import com.example.fixflow.domain.*;
import com.example.fixflow.repository.*;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.service.ReportVisionService;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:vision-api;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "openrouter.vision.enabled=false"
})
class ReportVisionIntegrationTest {
    @Autowired WebApplicationContext context;
    @Autowired ReportVisionService service;
    @Autowired SiteRepository sites;
    @Autowired UserRepository users;
    @Autowired ReportRepository reports;
    @Autowired ReportVisionJobRepository jobs;
    @MockitoBean VisionProvider provider;
    private MockMvc mvc;
    private User actor;
    private Report report;

    @BeforeEach void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        Site site = new Site(); site.setName("Vision campus"); site.setType(SiteType.school);
        site.setContractStatus(ContractStatus.contracted); site = sites.save(site);
        actor = new User(); actor.setEmail("vision-" + System.nanoTime() + "@example.test");
        actor.setFirstName("Test"); actor.setLastName("Reporter"); actor.setPasswordHash("unused");
        actor.setRole(UserRole.reporter); actor.setSite(site); actor = users.save(actor);
        report = new Report(); report.setSite(site); report.setCreatedBy(actor); report.setDescription("Pipe leak");
        report.setCategory("plumbing"); report.setReporterUrgency(Urgency.critical);
        report.setReporterReason("Water is dripping beside the sink");
        report.setSpecialty("water supply");
        report.setFinalUrgency(Urgency.medium); report = reports.save(report);
    }

    private MockMultipartFile image() throws Exception {
        var bytes = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(2, 2, BufferedImage.TYPE_INT_RGB), "png", bytes);
        return new MockMultipartFile("image", "issue.png", "image/png", bytes.toByteArray());
    }

    private String endpoint() { return "/api/reports/" + report.getId() + "/vision"; }
    private String enqueue() throws Exception {
        String body = mvc.perform(multipart(endpoint()).file(image()).param("consent", "true")
                .with(user(new AppUserDetails(actor))))
                .andExpect(status().isAccepted()).andExpect(jsonPath("$.status").value("queued"))
                .andReturn().getResponse().getContentAsString();
        return new com.fasterxml.jackson.databind.ObjectMapper().readTree(body).get("jobId").asText();
    }

    @Test void slowVisionDoesNotDelayReportCreationAndPersistsValidatedResults() throws Exception {
        CountDownLatch started = new CountDownLatch(1), finish = new CountDownLatch(1);
        when(provider.classifyImage(any())).thenAnswer(call -> {
            started.countDown();
            if (!finish.await(15, TimeUnit.SECONDS)) throw new IllegalStateException();
            return VisionClassificationResponse.builder().category("electrical").specialty("lighting")
                    .urgency("high").analysisDescription("Damaged lighting visible")
                    .urgencyReason("Exposed wiring may cause harm").model("test-vision").build();
        });
        String id = enqueue();
        verifyNoInteractions(provider);
        try (var executor = java.util.concurrent.Executors.newSingleThreadExecutor()) {
            var worker = executor.submit(service::processPending);
            try {
                assertThat(started.await(10, TimeUnit.SECONDS)).isTrue();
                mvc.perform(post("/api/reports").with(user(new AppUserDetails(actor)))
                        .contentType("application/json").content("""
                                {"description":"Another pipe leak","category":"plumbing","reporterUrgency":"medium"}
                                """))
                        .andExpect(status().isCreated());
                Report progressing = reports.findById(report.getId()).orElseThrow();
                progressing.setStatus(ReportStatus.routed); reports.save(progressing);
            } finally { finish.countDown(); }
            worker.get(15, TimeUnit.SECONDS);
        }
        Report stored = reports.findById(report.getId()).orElseThrow();
        assertThat(stored.getCategory()).isEqualTo("plumbing");
        assertThat(stored.getStatus()).isEqualTo(ReportStatus.routed);
        assertThat(stored.getAiCategory()).isEqualTo("electrical");
        assertThat(stored.getAiUrgency()).isEqualTo(Urgency.high);
        assertThat(stored.getReporterUrgency()).isEqualTo(Urgency.critical);
        assertThat(stored.getDescription()).isEqualTo("Pipe leak");
        assertThat(stored.getSpecialty()).isEqualTo("water supply");
        assertThat(stored.getReporterReason()).isEqualTo("Water is dripping beside the sink");
        assertThat(stored.getAiDescription()).isEqualTo("Damaged lighting visible");
        assertThat(stored.getAiUrgencyReason()).isEqualTo("Exposed wiring may cause harm");
        assertThat(stored.getFinalUrgency()).isEqualTo(Urgency.medium);
        assertThat(jobs.findById(id).orElseThrow().getImageData()).isNull();
        mvc.perform(get(endpoint() + "/" + id).with(user(new AppUserDetails(actor))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("completed"));
        mvc.perform(get("/api/reports/" + report.getId()).with(user(new AppUserDetails(actor))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.description").value("Pipe leak"))
                .andExpect(jsonPath("$.aiReport.urgency").value("high"))
                .andExpect(jsonPath("$.aiReport.description").isEmpty())
                .andExpect(jsonPath("$.aiReport.urgencyReason").isEmpty());
        User admin = new User(); admin.setEmail("vision-admin-" + System.nanoTime() + "@example.test");
        admin.setFirstName("Site"); admin.setLastName("Admin"); admin.setPasswordHash("unused");
        admin.setRole(UserRole.admin); admin.setSite(actor.getSite()); admin = users.save(admin);
        mvc.perform(get("/api/reports/" + report.getId()).with(user(new AppUserDetails(admin))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.description").value("Pipe leak"))
                .andExpect(jsonPath("$.aiReport.category").value("electrical"))
                .andExpect(jsonPath("$.aiReport.description").value("Damaged lighting visible"))
                .andExpect(jsonPath("$.aiReport.urgencyReason").value("Exposed wiring may cause harm"));
    }

    @Test void invalidResultFallsBackAndChangedReportIsNotOverwritten() throws Exception {
        when(provider.classifyImage(any())).thenReturn(VisionClassificationResponse.builder()
                .category("invented").urgency("extreme").build());
        String first = enqueue(); service.processPending();
        assertThat(jobs.findById(first).orElseThrow().getStatus()).isEqualTo("review_required");
        assertThat(reports.findById(report.getId()).orElseThrow().getAiCategory()).isEqualTo("general");
        String second = enqueue();
        Report changed = reports.findById(report.getId()).orElseThrow();
        changed.setCategory("carpentry"); reports.save(changed);
        service.processPending();
        assertThat(jobs.findById(second).orElseThrow().getStatus()).isEqualTo("stale");
        assertThat(reports.findById(report.getId()).orElseThrow().getCategory()).isEqualTo("carpentry");
    }

    @Test void rejectsMissingSessionConsentForgedImagesAndForeignUsers() throws Exception {
        mvc.perform(multipart(endpoint()).file(image()).param("consent", "true"))
                .andExpect(status().isUnauthorized());
        mvc.perform(multipart(endpoint()).file(image()).with(user(new AppUserDetails(actor))))
                .andExpect(status().isBadRequest());
        mvc.perform(multipart(endpoint()).file(new MockMultipartFile("image", "fake.png", "image/png", new byte[] {1,2,3}))
                .param("consent", "true").with(user(new AppUserDetails(actor))))
                .andExpect(status().isBadRequest());
        User other = new User(); other.setEmail("other-" + System.nanoTime() + "@example.test");
        other.setFirstName("Other"); other.setLastName("Reporter"); other.setPasswordHash("unused");
        other.setRole(UserRole.reporter); other.setSite(actor.getSite()); other = users.save(other);
        mvc.perform(multipart(endpoint()).file(image()).param("consent", "true")
                .with(user(new AppUserDetails(other)))).andExpect(status().isForbidden());
        String id = enqueue();
        mvc.perform(get(endpoint() + "/" + id).with(user(new AppUserDetails(other))))
                .andExpect(status().isForbidden());
        mvc.perform(multipart(endpoint()).file(image()).param("consent", "true")
                .with(user(new AppUserDetails(actor)))).andExpect(status().isConflict());
        verifyNoInteractions(provider);
    }
}
