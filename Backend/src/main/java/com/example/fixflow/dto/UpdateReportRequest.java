package com.example.fixflow.dto;

import com.example.fixflow.domain.Urgency;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record UpdateReportRequest(
        @NotBlank @Size(max = 10000) String description,
        @Size(max = 512) String address,
        @NotNull Urgency reporterUrgency,
        @Size(max = 2000) String reporterReason
) { }
