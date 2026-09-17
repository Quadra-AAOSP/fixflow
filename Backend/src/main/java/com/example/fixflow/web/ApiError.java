package com.example.fixflow.web;

import java.time.Instant;
import java.util.Map;

public record ApiError(
		Instant timestamp,
		int status,
		String error,
		String message,
		String path
) {
	public static ApiError of(int status, String error, String message, String path) {
		return new ApiError(Instant.now(), status, error, message, path);
	}

	public Map<String, Object> asMap() {
		return Map.of(
				"timestamp", timestamp,
				"status", status,
				"error", error,
				"message", message,
				"path", path
		);
	}
}
