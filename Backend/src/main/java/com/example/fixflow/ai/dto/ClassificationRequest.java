package com.example.fixflow.ai.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Request DTO for AI classification of maintenance reports.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ClassificationRequest {

    private String description;
    private String siteType;
    private List<String> allowedCategories;
    private String address;
}