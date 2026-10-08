package com.example.fixflow.dto;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
public record SubsiteRequest(@NotBlank @Size(max = 64) String label, @NotBlank @Size(max = 255) String name, String description) { }
