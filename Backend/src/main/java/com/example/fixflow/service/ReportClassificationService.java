package com.example.fixflow.service;

import java.util.List;
import java.util.Locale;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

import com.example.fixflow.ai.AIProvider;
import com.example.fixflow.ai.AIProviderException;
import com.example.fixflow.ai.dto.ClassificationRequest;
import com.example.fixflow.ai.dto.ClassificationResponse;
import com.example.fixflow.domain.Report;
import com.example.fixflow.domain.SiteRule;
import com.example.fixflow.domain.SiteType;
import com.example.fixflow.domain.Urgency;
import com.example.fixflow.repository.SiteRuleRepository;

/**
 * Applies AI classifications to reports using the fixed site-rule taxonomy.
 *
 * <p>Fallback policy: if no AI provider is configured, an AI call fails, or its
 * response contains an unknown category or urgency, the AI category becomes
 * the site's allowed {@code general}, or null if absent, with no AI urgency.
 * A null AI urgency marks the classification for staff review. Human-entered
 * description, category, specialty, urgency and reason are never overwritten.</p>
 */
@Service
public class ReportClassificationService {

    private static final Logger log = LoggerFactory.getLogger(ReportClassificationService.class);
    private static final String GENERAL_CATEGORY = "general";

    private final ObjectProvider<AIProvider> aiProvider;
    private final SiteRuleRepository siteRuleRepository;

    public ReportClassificationService(
            ObjectProvider<AIProvider> aiProvider,
            SiteRuleRepository siteRuleRepository) {
        this.aiProvider = aiProvider;
        this.siteRuleRepository = siteRuleRepository;
    }

    public void classify(Report report) {
        SiteType siteType = report.getSite().getType();
        List<String> allowedCategories = siteRuleRepository.findBySiteTypeOrderBySortOrderAsc(siteType).stream()
                .map(SiteRule::getCategory)
                .toList();
        AIProvider provider = aiProvider.getIfAvailable();
        if (provider == null) {
            applyFallback(report, siteType, "No AI provider is configured");
            return;
        }

        try {
            ClassificationResponse response = provider.classifyText(ClassificationRequest.builder()
                    .description(report.getDescription())
                    .address(report.getAddress())
                    .siteType(siteType.name())
                    .allowedCategories(allowedCategories)
                    .build());
            applyValidatedClassification(report, siteType, response);
        } catch (AIProviderException | RuntimeException exception) {
            applyFallback(report, siteType, "Invalid or unavailable AI classification");
        }
    }

    public void applyVision(Report report, com.example.fixflow.ai.dto.VisionClassificationResponse result) {
        try {
            applyValidatedClassification(report, report.getSite().getType(),
                    ClassificationResponse.builder().category(result.getCategory())
                            .specialty(result.getSpecialty()).urgency(result.getUrgency())
                            .analysisDescription(result.getAnalysisDescription()).urgencyReason(result.getUrgencyReason()).build());
        } catch (RuntimeException invalid) {
            applyFallback(report, report.getSite().getType(), "Invalid or unavailable vision classification");
        }
    }

    private void applyValidatedClassification(
            Report report,
            SiteType siteType,
            ClassificationResponse response) {
        String category = normalize(response.getCategory());
        String urgency = normalize(response.getUrgency());
        if (category == null || urgency == null
                || !siteRuleRepository.existsBySiteTypeAndCategory(siteType, category)) {
            applyFallback(report, siteType, "AI returned a category or urgency outside the fixed taxonomy");
            return;
        }

        // Validate urgency before mutating the last valid category.
        Urgency aiUrgency = Urgency.valueOf(urgency);
        report.setAiCategory(category);
        report.setAiSpecialty(truncate(normalize(response.getSpecialty()), 128));
        report.setAiUrgency(aiUrgency);
        report.setAiDescription(truncate(response.getAnalysisDescription(), 2000));
        report.setAiUrgencyReason(truncate(response.getUrgencyReason(), 2000));
    }

    private void applyFallback(Report report, SiteType siteType, String reason) {
        if (siteRuleRepository.existsBySiteTypeAndCategory(siteType, GENERAL_CATEGORY)) {
            report.setAiCategory(GENERAL_CATEGORY);
        } else {
            report.setAiCategory(null);
        }
        report.setAiSpecialty(null);
        report.setAiUrgency(null);
        report.setAiDescription(null);
        report.setAiUrgencyReason(null);
        log.warn("Report {} requires staff AI-classification review: {}", report.getId(), reason);
    }

    private String normalize(String value) {
        return value == null || value.isBlank() ? null : value.trim().toLowerCase(Locale.ROOT);
    }

    private String truncate(String value, int maxLength) {
        return value == null || value.length() <= maxLength ? value : value.substring(0, maxLength);
    }
}
