package com.example.fixflow.web;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public record ApiError(
		Instant timestamp,
		int status,
		String error,
		String code,
		String message,
		String path,
		String traceId,
		List<FieldErrorDetail> fieldErrors
) {
	public record FieldErrorDetail(String field, String message) {
	}

	public static ApiError of(int status, String error, String message, String path) {
		return of(status, error, errorCode(status), message, path, TraceIdFilter.currentTraceId(), null);
	}

	public static ApiError of(
			int status,
			String error,
			String code,
			String message,
			String path,
			String traceId,
			List<FieldErrorDetail> fieldErrors
	) {
		return new ApiError(
				Instant.now(),
				status,
				error,
				code,
				message,
				path,
				traceId,
				fieldErrors
		);
	}

	public static ApiError validation(
			String message,
			String path,
			List<FieldErrorDetail> fieldErrors
	) {
		return of(400, "Bad Request", "VALIDATION_ERROR", message, path, TraceIdFilter.currentTraceId(), fieldErrors);
	}

	private static String errorCode(int status) {
		return switch (status) {
			case 400 -> "BAD_REQUEST";
			case 401 -> "UNAUTHORIZED";
			case 403 -> "FORBIDDEN";
			case 404 -> "NOT_FOUND";
			case 409 -> "CONFLICT";
			case 415 -> "UNSUPPORTED_MEDIA_TYPE";
			case 422 -> "UNPROCESSABLE_ENTITY";
			default -> "ERROR_" + status;
		};
	}

	public Map<String, Object> asMap() {
		Map<String, Object> map = new LinkedHashMap<>();
		map.put("timestamp", timestamp.toString());
		map.put("status", status);
		map.put("error", error);
		map.put("code", code);
		map.put("message", message);
		map.put("path", path);
		if (traceId != null) {
			map.put("traceId", traceId);
		}
		if (fieldErrors != null && !fieldErrors.isEmpty()) {
			map.put("fieldErrors", fieldErrors);
		}
		return map;
	}
}
