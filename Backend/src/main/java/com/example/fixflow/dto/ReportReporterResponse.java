package com.example.fixflow.dto;

import java.time.Instant;

public record ReportReporterResponse(
		Long reportId,
		Long userId,
		Instant joinedAt
) {
}
