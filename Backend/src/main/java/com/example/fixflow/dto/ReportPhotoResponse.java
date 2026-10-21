package com.example.fixflow.dto;

import com.example.fixflow.domain.ReportPhoto;

public record ReportPhotoResponse(
		Long id,
		String contentType,
		int fileSizeBytes,
		int sortOrder,
		String retrievalPath
) {
	public static ReportPhotoResponse from(ReportPhoto photo, Long reportId) {
		return new ReportPhotoResponse(
				photo.getId(),
				photo.getContentType(),
				photo.getFileSizeBytes(),
				photo.getSortOrder(),
				"/api/reports/" + reportId + "/photos/" + photo.getId()
		);
	}
}
