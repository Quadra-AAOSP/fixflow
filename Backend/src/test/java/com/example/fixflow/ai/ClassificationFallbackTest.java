package com.example.fixflow.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import java.util.List;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.ObjectProvider;
import com.example.fixflow.ai.dto.ClassificationResponse;
import com.example.fixflow.domain.*;
import com.example.fixflow.repository.SiteRuleRepository;
import com.example.fixflow.service.ReportClassificationService;

class ClassificationFallbackTest {
    @ParameterizedTest
    @ValueSource(strings = {"null", "empty", "urgency", "provider", "runtime", "missing-provider"})
    void invalidResponsesUseGeneralWhenAllowed(String failure) throws Exception {
        check(failure, true);
    }
    @ParameterizedTest
    @ValueSource(strings = {"null", "empty", "urgency", "provider", "runtime", "missing-provider"})
    void missingGeneralRetainsOriginalCategory(String failure) throws Exception {
        check(failure, false);
    }
    @SuppressWarnings("unchecked")
    private void check(String failure, boolean general) throws Exception {
        ObjectProvider<AIProvider> providers = mock(ObjectProvider.class);
        AIProvider provider = mock(AIProvider.class);
        SiteRuleRepository rules = mock(SiteRuleRepository.class);
        when(rules.findBySiteTypeOrderBySortOrderAsc(SiteType.school)).thenReturn(List.of());
        when(rules.existsBySiteTypeAndCategory(SiteType.school, "general")).thenReturn(general);
        when(providers.getIfAvailable()).thenReturn(failure.equals("missing-provider") ? null : provider);
        switch (failure) {
            case "null" -> when(provider.classifyText(any())).thenReturn(null);
            case "empty" -> when(provider.classifyText(any())).thenReturn(ClassificationResponse.builder().build());
            case "urgency" -> {
                when(rules.existsBySiteTypeAndCategory(SiteType.school, "electrical")).thenReturn(true);
                when(provider.classifyText(any())).thenReturn(ClassificationResponse.builder()
                        .category("electrical").specialty("wiring").urgency("urgent").build());
            }
            case "provider" -> when(provider.classifyText(any())).thenThrow(
                    new AIProviderException("unavailable", AIProviderException.AIErrorType.NETWORK_ERROR));
            case "runtime" -> when(provider.classifyText(any())).thenThrow(new IllegalArgumentException("malformed output"));
            default -> { }
        }
        Site site = new Site(); site.setType(SiteType.school);
        Report report = new Report(); report.setSite(site); report.setDescription("Leak");
        report.setCategory("plumbing"); report.setSpecialty("old specialty"); report.setAiUrgency(Urgency.high);
        report.setReporterUrgency(Urgency.critical); report.setReporterReason("Reporter explanation");
        new ReportClassificationService(providers, rules).classify(report);
        assertThat(report.getCategory()).isEqualTo("plumbing");
        assertThat(report.getAiCategory()).isEqualTo(general ? "general" : null);
        assertThat(report.getSpecialty()).isEqualTo("old specialty");
        assertThat(report.getAiSpecialty()).isNull(); assertThat(report.getAiUrgency()).isNull();
        assertThat(report.getReporterUrgency()).isEqualTo(Urgency.critical);
        assertThat(report.getReporterReason()).isEqualTo("Reporter explanation");
    }
}
