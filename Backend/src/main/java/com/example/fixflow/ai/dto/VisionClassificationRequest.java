package com.example.fixflow.ai.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Request DTO for AI vision classification of maintenance report images.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VisionClassificationRequest {

    private byte[] imageData;
    private String mimeType;
    private String description;
    private String siteType;
    private List<String> allowedCategories;
    private String address;
}