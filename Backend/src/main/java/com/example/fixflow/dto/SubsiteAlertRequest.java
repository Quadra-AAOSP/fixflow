package com.example.fixflow.dto;
import jakarta.validation.constraints.Size;
public record SubsiteAlertRequest(@Size(max = 1000) String note) { }
