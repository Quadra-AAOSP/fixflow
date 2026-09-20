package com.example.fixflow.ai.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Response DTO for AI classification of maintenance reports.
 * Contains the predicted category, specialty, and urgency levels.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ClassificationResponse {

    private String category;
    private String specialty;
    private String urgency;
    private String provider;
    private String model;
    @Builder.Default
    private boolean confidence = true;
}