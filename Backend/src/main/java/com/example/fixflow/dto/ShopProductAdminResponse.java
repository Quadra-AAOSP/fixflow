package com.example.fixflow.dto;

import java.time.Instant;

import com.example.fixflow.domain.ShopProduct;

public record ShopProductAdminResponse(
		String id,
		String name,
		String description,
		String category,
		String brand,
		String imageUrl,
		int priceMinor,
		int stock,
		boolean active,
		Instant createdAt,
		Instant updatedAt
) {
	public static ShopProductAdminResponse from(ShopProduct product) {
		return new ShopProductAdminResponse(
				product.getId(),
				product.getName(),
				product.getDescription(),
				product.getCategory(),
				product.getBrand(),
				product.getImageUrl(),
				product.getPriceMinor(),
				product.getStock(),
				product.isActive(),
				product.getCreatedAt(),
				product.getUpdatedAt()
		);
	}
}
