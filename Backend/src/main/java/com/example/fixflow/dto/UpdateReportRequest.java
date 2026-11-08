package com.example.fixflow.dto;

import com.example.fixflow.domain.ReportVisibility;
import com.example.fixflow.domain.Urgency;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Edit payload for an existing report. Description and reporter urgency are
 * always sent; the remaining fields are optional refinements so a client can
 * also adjust the category, specialty or visibility while the report is still
 * editable.
 */
public record UpdateReportRequest(
        @NotBlank @Size(max = 10000) String description,
        @Size(max = 512) String address,
        @NotNull Urgency reporterUrgency,
        @Size(max = 2000) String reporterReason,
        @Size(max = 128) String category,
        @Size(max = 128) String specialty,
        ReportVisibility visibility
) { }
