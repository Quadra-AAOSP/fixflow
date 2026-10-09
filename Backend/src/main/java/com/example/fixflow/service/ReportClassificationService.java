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
 * response contains an unknown category or urgency, the report is classified as
 * the site's allowed {@code general} category with no AI urgency or specialty.
 * A null AI urgency marks the classification for staff review. Reporter-entered
 * urgency is never read or changed by this service.</p>
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
            applyFallback(report, siteType, "Invalid or unavailable AI classification: " + exception.getMessage());
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

        report.setCategory(category);
        report.setSpecialty(truncate(normalize(response.getSpecialty()), 128));
        report.setAiUrgency(Urgency.valueOf(urgency));
    }

    private void applyFallback(Report report, SiteType siteType, String reason) {
        if (siteRuleRepository.existsBySiteTypeAndCategory(siteType, GENERAL_CATEGORY)) {
            report.setCategory(GENERAL_CATEGORY);
        }
        report.setSpecialty(null);
        report.setAiUrgency(null);
        log.warn("Report {} requires staff AI-classification review: {}", report.getId(), reason);
    }

    private String normalize(String value) {
        return value == null || value.isBlank() ? null : value.trim().toLowerCase(Locale.ROOT);
    }

    private String truncate(String value, int maxLength) {
        return value == null || value.length() <= maxLength ? value : value.substring(0, maxLength);
    }
}
