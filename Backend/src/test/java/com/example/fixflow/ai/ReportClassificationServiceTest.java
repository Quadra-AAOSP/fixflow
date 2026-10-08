package com.example.fixflow.ai;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;

import com.example.fixflow.ai.dto.ClassificationRequest;
import com.example.fixflow.ai.dto.ClassificationResponse;
import com.example.fixflow.domain.ContractStatus;
import com.example.fixflow.domain.Report;
import com.example.fixflow.domain.Site;
import com.example.fixflow.domain.SiteRule;
import com.example.fixflow.domain.SiteType;
import com.example.fixflow.domain.Urgency;
import com.example.fixflow.repository.SiteRuleRepository;
import com.example.fixflow.service.ReportClassificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;

@ExtendWith(MockitoExtension.class)
class ReportClassificationServiceTest {

    @Mock
    private ObjectProvider<AIProvider> aiProvider;

    @Mock
    private AIProvider provider;

    @Mock
    private SiteRuleRepository siteRuleRepository;

    private ReportClassificationService service;

    @BeforeEach
    void setUp() {
        service = new ReportClassificationService(aiProvider, siteRuleRepository);
    }

    @Test
    void storesOnlyValidatedAiClassificationAndPreservesReporterUrgency() throws Exception {
        Report report = report();
        when(aiProvider.getIfAvailable()).thenReturn(provider);
        when(siteRuleRepository.findBySiteTypeOrderBySortOrderAsc(SiteType.school))
                .thenReturn(List.of(rule("plumbing"), rule("electrical")));
        when(siteRuleRepository.existsBySiteTypeAndCategory(SiteType.school, "plumbing")).thenReturn(true);
        when(provider.classifyText(any())).thenReturn(ClassificationResponse.builder()
                .category("PLUMBING")
                .specialty("Water supply")
                .urgency("high")
                .build());

        service.classify(report);

        assertEquals("plumbing", report.getCategory());
        assertEquals("water supply", report.getSpecialty());
        assertEquals(Urgency.high, report.getAiUrgency());
        assertEquals(Urgency.medium, report.getReporterUrgency());
        ArgumentCaptor<ClassificationRequest> request = ArgumentCaptor.forClass(ClassificationRequest.class);
        verify(provider).classifyText(request.capture());
        assertEquals(List.of("plumbing", "electrical"), request.getValue().getAllowedCategories());
    }

    @Test
    void fallsBackToGeneralAndLeavesAiUrgencyUnresolvedForUnknownAiCategory() throws Exception {
        Report report = report();
        when(aiProvider.getIfAvailable()).thenReturn(provider);
        when(siteRuleRepository.findBySiteTypeOrderBySortOrderAsc(SiteType.school))
                .thenReturn(List.of(rule("plumbing"), rule("general")));
        when(provider.classifyText(any())).thenReturn(ClassificationResponse.builder()
                .category("new_ai_category")
                .specialty("anything")
                .urgency("critical")
                .build());
        when(siteRuleRepository.existsBySiteTypeAndCategory(SiteType.school, "new_ai_category")).thenReturn(false);
        when(siteRuleRepository.existsBySiteTypeAndCategory(SiteType.school, "general")).thenReturn(true);

        service.classify(report);

        assertEquals("general", report.getCategory());
        assertNull(report.getSpecialty());
        assertNull(report.getAiUrgency());
        assertEquals(Urgency.medium, report.getReporterUrgency());
    }

    private Report report() {
        Site site = new Site();
        site.setType(SiteType.school);
        site.setContractStatus(ContractStatus.contracted);
        Report report = new Report();
        report.setSite(site);
        report.setDescription("Water is leaking from a pipe");
        report.setCategory("plumbing");
        report.setReporterUrgency(Urgency.medium);
        return report;
    }

    private SiteRule rule(String category) {
        SiteRule rule = new SiteRule();
        rule.setCategory(category);
        return rule;
    }
}
