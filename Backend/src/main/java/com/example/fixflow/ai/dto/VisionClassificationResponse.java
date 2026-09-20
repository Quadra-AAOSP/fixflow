package com.example.fixflow.ai.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Response DTO for AI vision classification of maintenance report images.
 * Contains the predicted category, specialty, and urgency levels from image analysis.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VisionClassificationResponse {

    private String category;
    private String specialty;
    private String urgency;
    private String provider;
    private String model;
    @Builder.Default
    private boolean confidence = true;
    private String analysisDescription;
}