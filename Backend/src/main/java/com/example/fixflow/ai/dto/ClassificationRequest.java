package com.example.fixflow.ai.dto;

import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Classification input for text and vision. Image fields are only set for vision.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ClassificationRequest {

	private String description;
	private String siteType;
	private List<String> allowedCategories;
	private String address;
	private byte[] imageData;
	private String mimeType;
}
