package com.example.fixflow.ai;

import com.example.fixflow.ai.dto.VisionClassificationRequest;
import com.example.fixflow.ai.dto.VisionClassificationResponse;

/**
 * Interface for AI vision providers that can classify maintenance report images.
 * This is separate from text classification to allow different providers and models
 * for image analysis without affecting the text classification pipeline.
 */
public interface VisionProvider {

    /**
     * Classifies a maintenance report image to determine category, specialty, and urgency.
     *
     * @param request The vision classification request containing image data and context
     * @return Vision classification response with category, specialty, and urgency predictions
     * @throws AIProviderException if the classification fails due to API errors, timeouts, or rate limits
     */
    VisionClassificationResponse classifyImage(VisionClassificationRequest request) throws AIProviderException;

    /**
     * Gets the provider name for logging and monitoring purposes.
     *
     * @return The provider name (e.g., "OpenRouterVision", "GeminiVision")
     */
    String getProviderName();
}