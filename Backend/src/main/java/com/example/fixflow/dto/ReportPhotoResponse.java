package com.example.fixflow.dto;

import java.time.Instant;

public record ReportPhotoResponse(
		Long id,
		String objectKey,
		String url,
		String contentType,
		int fileSizeBytes,
		int sortOrder,
		Instant createdAt
) {
}
