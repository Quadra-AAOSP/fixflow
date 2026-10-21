package com.example.fixflow.dto;

import java.time.Instant;

import com.example.fixflow.domain.ReportPhoto;

public record ReportPhotoResponse(
		Long id,
		String objectKey,
		String url,
		String contentType,
		int fileSizeBytes,
		int sortOrder,
		Instant createdAt,
		String retrievalPath
) {
	public static ReportPhotoResponse from(ReportPhoto photo, Long reportId, String url) {
		return new ReportPhotoResponse(
				photo.getId(),
				photo.getObjectKey(),
				url,
				photo.getContentType(),
				photo.getFileSizeBytes(),
				photo.getSortOrder(),
				photo.getCreatedAt(),
				"/api/reports/" + reportId + "/photos/" + photo.getId()
		);
	}

	public static ReportPhotoResponse from(ReportPhoto photo, Long reportId) {
		return from(photo, reportId, null);
	}
}
