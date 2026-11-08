package com.example.fixflow.ai;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.assertj.core.api.Assertions.assertThat;

import com.example.fixflow.domain.*;
import com.example.fixflow.repository.*;
import com.example.fixflow.security.AppUserDetails;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.time.Duration;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContextInitializer;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.io.FileSystemResource;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@EnabledIfEnvironmentVariable(named = "FIXFLOW_LIVE_AI_TEST", matches = "true")
@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:live-ai-smoke;MODE=MySQL;DB_CLOSE_DELAY=-1",
    "openrouter.vision.enabled=true", "openrouter.ranking.enabled=true"
})
@ContextConfiguration(initializers = LiveAiSmokeTest.ProviderSettings.class)
class LiveAiSmokeTest {
    static class ProviderSettings implements ApplicationContextInitializer<ConfigurableApplicationContext> {
        @Override public void initialize(ConfigurableApplicationContext context) {
            try {
                var application = new FileSystemResource("src/main/resources/application.yaml");
                for (var source : new YamlPropertySourceLoader().load("app-ai-defaults", application)) {
                    var aiSettings = new java.util.HashMap<String, Object>();
                    if (source instanceof org.springframework.core.env.EnumerablePropertySource<?> properties) {
                        for (String key : properties.getPropertyNames()) {
                            if (key.startsWith("openrouter.")) {
                                aiSettings.put(key, properties.getProperty(key));
                            }
                        }
                    }
                    context.getEnvironment().getPropertySources().addLast(
                            new org.springframework.core.env.MapPropertySource("app-ai-defaults", aiSettings));
                }
            } catch (java.io.IOException failure) {
                throw new IllegalStateException("Could not read application AI settings", failure);
            }
        }
    }
    @Autowired WebApplicationContext context;
    @Autowired SiteRepository sites;
    @Autowired UserRepository users;
    @Autowired ReportRepository reports;
    @Autowired TechnicianContractRepository contracts;
    @Autowired TechnicianSkillRepository skills;
    @Autowired TechnicianAvailabilityRepository availability;
    private MockMvc mvc;
    private final ObjectMapper json = new ObjectMapper();
    private Site site;
    private User admin;
    private User reporter;
    private String endpoint;

    @BeforeEach void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        site = new Site();
        site.setName("Synthetic AI verification site");
        site.setType(SiteType.school);
        site.setContractStatus(ContractStatus.contracted);
        site = sites.save(site);
        admin = account(UserRole.admin, site);
        reporter = account(UserRole.reporter, site);
        var report = new Report();
        report.setSite(site);
        report.setCreatedBy(reporter);
        report.setDescription("Water drips slowly from a loose sink pipe in a test facility.");
        report.setCategory("plumbing");
        report.setReporterUrgency(Urgency.critical);
        report.setFinalUrgency(Urgency.medium);
        endpoint = "/api/reports/" + reports.save(report).getId();
    }

    private User account(UserRole role, Site scope) {
        var user = new User();
        user.setEmail(UUID.randomUUID() + "@example.test");
        user.setFirstName("Synthetic");
        user.setLastName("Test");
        user.setPasswordHash("unused");
        user.setRole(role);
        user.setSite(scope);
        return users.save(user);
    }

    @Test void manualClassificationPersistsAiUrgency() throws Exception {
        long start = System.nanoTime();
        mvc.perform(post(endpoint + "/classify").with(user(new AppUserDetails(admin))).with(csrf()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.aiUrgency").isNotEmpty())
                .andExpect(jsonPath("$.reporterUrgency").value("critical"));
        mvc.perform(get(endpoint).with(user(new AppUserDetails(admin))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.aiReport.urgency").isNotEmpty());
        elapsed("Manual classification", start);
    }

    @Test void reportAssistantReturnsLiveReply() throws Exception {
        long start = System.nanoTime();
        mvc.perform(post(endpoint + "/assistant").with(user(new AppUserDetails(admin))).with(csrf())
                .contentType("application/json")
                .content("""
                        {"messages":[{"role":"user","content":"What problem does this report describe?"}]}
                        """))
                .andExpect(status().isOk()).andExpect(jsonPath("$.reply").isNotEmpty())
                .andExpect(jsonPath("$.fallback").value(false));
        elapsed("Report assistant", start);
    }

    @Test void preReportTriageReturnsLiveReply() throws Exception {
        long start = System.nanoTime();
        mvc.perform(post("/api/assistant/triage").with(user(new AppUserDetails(reporter))).with(csrf())
                .contentType("application/json")
                .content("""
                        {"siteId":%d,"messages":[{"role":"user","content":"A sink pipe drips slowly, with no water on the floor. Help me draft a report."}]}
                        """.formatted(site.getId())))
                .andExpect(status().isOk()).andExpect(jsonPath("$.reply").isNotEmpty())
                .andExpect(jsonPath("$.fallback").value(false));
        elapsed("Pre-report triage", start);
    }

    @Test void asynchronousVisionCompletesAndKeepsHumanUrgency() throws Exception {
        var bytes = new ByteArrayOutputStream();
        var picture = new BufferedImage(512, 384, BufferedImage.TYPE_INT_RGB);
        var painter = picture.createGraphics();
        try {
            painter.setColor(java.awt.Color.WHITE);
            painter.fillRect(0, 0, 512, 384);
            painter.setColor(java.awt.Color.GRAY);
            painter.fillRect(110, 90, 210, 60);
            painter.setColor(java.awt.Color.BLUE);
            painter.fillOval(240, 162, 16, 24);
            painter.fillOval(240, 200, 16, 24);
        } finally {
            painter.dispose();
        }
        ImageIO.write(picture, "png", bytes);
        var image = new MockMultipartFile("image", "synthetic.png", "image/png", bytes.toByteArray());
        long start = System.nanoTime();
        var queued = mvc.perform(multipart(endpoint + "/vision").file(image).param("consent", "true")
                .with(user(new AppUserDetails(reporter))).with(csrf()))
                .andExpect(status().isAccepted()).andExpect(jsonPath("$.status").value("queued"))
                .andReturn().getResponse();
        String jobId = json.readTree(queued.getContentAsString()).path("jobId").asText();
        long deadline = System.nanoTime() + Duration.ofSeconds(200).toNanos();
        String state;
        do {
            var response = mvc.perform(get(endpoint + "/vision/" + jobId).with(user(new AppUserDetails(reporter))))
                    .andExpect(status().isOk()).andReturn().getResponse();
            state = json.readTree(response.getContentAsString()).path("status").asText();
            if (!state.equals("queued") && !state.equals("processing")) {
                break;
            }
            Thread.sleep(1000);
        } while (System.nanoTime() < deadline);
        assertThat(state).isEqualTo("completed");
        mvc.perform(get(endpoint).with(user(new AppUserDetails(admin))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.aiReport.description").isNotEmpty())
                .andExpect(jsonPath("$.aiReport.urgencyReason").isNotEmpty())
                .andExpect(jsonPath("$.reporterUrgency").value("critical"));
        mvc.perform(get(endpoint).with(user(new AppUserDetails(reporter))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.aiReport.urgency").isNotEmpty())
                .andExpect(jsonPath("$.aiReport.urgencyReason").isEmpty());
        elapsed("Queued vision", start);
    }

    @Test void aiRankingReturnsEligibleCandidates() throws Exception {
        for (int i = 0; i < 2; i++) {
            var technician = account(UserRole.technician, null);
            var contract = new TechnicianContract();
            contract.setTechnician(technician);
            contract.setSite(site);
            contracts.save(contract);
            var skill = new TechnicianSkill();
            skill.setTechnician(technician);
            skill.setCategory("plumbing");
            skill.setProficiency(4);
            skills.save(skill);
            var available = new TechnicianAvailability();
            available.setTechnician(technician);
            available.setStatus(AvailabilityStatus.available);
            availability.save(available);
        }
        long start = System.nanoTime();
        mvc.perform(post(endpoint + "/technician-ranking").with(user(new AppUserDetails(admin))).with(csrf())
                .contentType("application/json").content("{\"mode\":\"AI\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.methodUsed").value("AI"))
                .andExpect(jsonPath("$.candidates.length()").value(2));
        elapsed("Technician ranking", start);
    }

    private void elapsed(String feature, long start) {
        System.out.println(feature + " live check completed in " + Duration.ofNanos(System.nanoTime() - start).toMillis() + " ms");
    }
}
