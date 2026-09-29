package com.example.fixflow.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ShopProductRequest(
		@NotBlank @Size(max = 64) String id,
		@NotBlank @Size(max = 255) String name,
		@NotBlank String description,
		@NotBlank @Size(max = 128) String category,
		@Size(max = 128) String brand,
		@Size(max = 1024) String imageUrl,
		@NotNull @Min(0) Integer priceMinor,
		@NotNull @Min(0) Integer stock,
		Boolean active
) {
}
