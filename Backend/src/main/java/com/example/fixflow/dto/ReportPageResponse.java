package com.example.fixflow.dto;

import java.util.List;

public record ReportPageResponse(
		List<ReportResponse> content,
		int page,
		int size,
		long totalElements,
		int totalPages
) {
}
