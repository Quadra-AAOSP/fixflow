package com.example.fixflow.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import com.example.fixflow.ai.dto.ClassificationResponse;
import com.example.fixflow.domain.*;
import com.example.fixflow.repository.*;
import com.example.fixflow.security.AppUserDetails;

@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:classification-api;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE")
class ClassificationApiIntegrationTest {
    @Autowired WebApplicationContext context;
    @Autowired SiteRepository sites;
    @Autowired UserRepository users;
    @Autowired ReportRepository reports;
    @MockitoBean AIProvider provider;
    private MockMvc mvc;
    private Site site;
    private User admin;
    private Report report;
    @BeforeEach void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        site = new Site(); site.setName("Classification campus"); site.setType(SiteType.school);
        site.setContractStatus(ContractStatus.uncontracted); site = sites.save(site);
        admin = account(UserRole.admin, site);
        report = new Report(); report.setSite(site); report.setCreatedBy(admin); report.setDescription("Pipe leak");
        report.setCategory("plumbing"); report.setReporterUrgency(Urgency.critical); report.setReporterReason("Do not replace");
        report.setFinalUrgency(Urgency.medium); report = reports.save(report);
    }
    private User account(UserRole role, Site target) {
        User u = new User(); u.setEmail("classification-" + System.nanoTime() + "@example.com");
        u.setPasswordHash("unused"); u.setFirstName("Test"); u.setLastName("Admin"); u.setRole(role); u.setSite(target);
        return users.save(u);
    }
    private String endpoint() { return "/api/reports/" + report.getId() + "/classify"; }

    @ParameterizedTest @EnumSource(value = UserRole.class, names = {"admin", "super_admin"})
    void authorizedClassificationPersistsAndPreservesReporterFields(UserRole role) throws Exception {
        User actor = role == UserRole.admin ? admin : account(role, null);
        when(provider.classifyText(any())).thenReturn(ClassificationResponse.builder()
                .category("electrical").specialty("wiring").urgency("high").build());
        mvc.perform(post(endpoint()).with(user(new AppUserDetails(actor))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.category").value("electrical"))
                .andExpect(jsonPath("$.aiUrgency").value("high"));
        Report stored = reports.findById(report.getId()).orElseThrow();
        assertThat(stored.getCategory()).isEqualTo("electrical"); assertThat(stored.getSpecialty()).isEqualTo("wiring");
        assertThat(stored.getAiUrgency()).isEqualTo(Urgency.high);
        assertThat(stored.getReporterUrgency()).isEqualTo(Urgency.critical);
        assertThat(stored.getReporterReason()).isEqualTo("Do not replace");
        assertThat(stored.getFinalUrgency()).isEqualTo(Urgency.medium);
        mvc.perform(get("/api/reports/" + stored.getId()).with(user(new AppUserDetails(actor))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.category").value("electrical"));
    }
    @ParameterizedTest @EnumSource(value = UserRole.class, names = {"reporter", "technician", "staff"})
    void wrongRolesCannotInvokeProvider(UserRole role) throws Exception {
        mvc.perform(post(endpoint()).with(user(new AppUserDetails(account(role, site)))))
                .andExpect(status().isForbidden()); verifyNoInteractions(provider);
        assertThat(reports.findById(report.getId()).orElseThrow().getAiUrgency()).isNull();
    }
    @Test void noSessionWrongSiteAndMissingIdNeverInvokeProvider() throws Exception {
        mvc.perform(post(endpoint())).andExpect(status().isUnauthorized());
        Site other = new Site(); other.setName("Other"); other.setType(SiteType.school);
        other.setContractStatus(ContractStatus.uncontracted); other = sites.save(other);
        mvc.perform(post(endpoint()).with(user(new AppUserDetails(account(UserRole.admin, other)))))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/reports/9223372036854775807/classify").with(user(new AppUserDetails(admin))))
                .andExpect(status().isNotFound()); verifyNoInteractions(provider);
    }
    @Test void invalidProviderResponsePersistsReviewableFallback() throws Exception {
        when(provider.classifyText(any())).thenReturn(null);
        mvc.perform(post(endpoint()).with(user(new AppUserDetails(admin))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.category").value("general"))
                .andExpect(jsonPath("$.aiUrgency").isEmpty());
        Report stored = reports.findById(report.getId()).orElseThrow();
        assertThat(stored.getCategory()).isEqualTo("general"); assertThat(stored.getAiUrgency()).isNull();
        assertThat(stored.getReporterUrgency()).isEqualTo(Urgency.critical);
    }
    @Test void submissionNeverContactsAiAndProviderFailuresPersistFallback() throws Exception {
        mvc.perform(post("/api/reports").with(user(new AppUserDetails(admin)))
                .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .content("{\"description\":\"New leak\",\"category\":\"plumbing\",\"reporterUrgency\":\"high\"}"))
                .andExpect(status().isCreated());
        verifyNoInteractions(provider);
        when(provider.classifyText(any())).thenThrow(new AIProviderException("timeout", AIProviderException.AIErrorType.TIMEOUT));
        mvc.perform(post(endpoint()).with(user(new AppUserDetails(admin))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.category").value("general"));
        assertThat(reports.findById(report.getId()).orElseThrow().getCategory()).isEqualTo("general");
    }
}
