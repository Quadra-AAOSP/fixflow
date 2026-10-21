package com.example.fixflow.service;

import java.util.List;
import java.util.Locale;
import java.util.Set;

import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import com.example.fixflow.web.ApiException;

@Component
public class ReportPhotoValidator {

	public static final int MAX_PHOTOS = 5;
	public static final long MAX_BYTES = 5L * 1024 * 1024;

	private static final Set<String> ALLOWED_TYPES = Set.of(
			"image/jpeg",
			"image/jpg",
			"image/png",
			"image/webp",
			"image/gif"
	);

	public void validateBatch(List<MultipartFile> files, int existingCount) {
		if (files == null || files.isEmpty()) {
			return;
		}
		List<MultipartFile> present = files.stream()
				.filter(file -> file != null && !file.isEmpty())
				.toList();
		if (existingCount + present.size() > MAX_PHOTOS) {
			throw new ApiException(422, "A report may have at most " + MAX_PHOTOS + " photos");
		}
		for (MultipartFile file : present) {
			validateOne(file);
		}
	}

	public void validateOne(MultipartFile file) {
		if (file == null || file.isEmpty()) {
			throw new ApiException(400, "Empty photo upload");
		}
		if (file.getSize() > MAX_BYTES) {
			throw new ApiException(422, "Each photo must be at most 5 MiB");
		}
		String contentType = normalizeContentType(file.getContentType());
		if (!ALLOWED_TYPES.contains(contentType)) {
			throw new ApiException(422, "Photo must be jpeg, png, webp, or gif");
		}
	}

	public String normalizeContentType(String contentType) {
		if (contentType == null || contentType.isBlank()) {
			return "";
		}
		String normalized = contentType.trim().toLowerCase(Locale.ROOT);
		int semi = normalized.indexOf(';');
		return semi >= 0 ? normalized.substring(0, semi).trim() : normalized;
	}

	public String extensionFor(String contentType) {
		return switch (normalizeContentType(contentType)) {
			case "image/jpeg", "image/jpg" -> "jpg";
			case "image/png" -> "png";
			case "image/webp" -> "webp";
			case "image/gif" -> "gif";
			default -> "bin";
		};
	}
}
