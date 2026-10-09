package com.example.fixflow.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record ContractApplicationRequest(@NotNull @Positive Long siteId, @Size(max = 1000) String note) {}
