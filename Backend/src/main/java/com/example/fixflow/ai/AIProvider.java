package com.example.fixflow.ai;

import com.example.fixflow.ai.dto.ClassificationRequest;
import com.example.fixflow.ai.dto.ClassificationResponse;

/**
 * Interface for AI providers that can classify maintenance reports.
 * This abstraction allows switching between different AI providers (OpenRouter, etc.)
 * without changing the frontend or business logic.
 */
public interface AIProvider {

    /**
     * Classifies a maintenance report description to determine category, specialty, and urgency.
     *
     * @param request The classification request containing the report description and context
     * @return Classification response with category, specialty, and urgency predictions
     * @throws AIProviderException if the classification fails due to API errors, timeouts, or rate limits
     */
    ClassificationResponse classifyText(ClassificationRequest request) throws AIProviderException;

    /**
     * Gets the provider name for logging and monitoring purposes.
     *
     * @return The provider name (e.g., "OpenRouter")
     */
    String getProviderName();
}