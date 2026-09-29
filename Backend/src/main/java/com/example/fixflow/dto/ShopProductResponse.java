package com.example.fixflow.dto;

import com.example.fixflow.domain.ShopProduct;

public record ShopProductResponse(
		String id,
		String name,
		String description,
		String category,
		String brand,
		String imageUrl,
		int priceMinor,
		int stock
) {
	public static ShopProductResponse from(ShopProduct product) {
		return new ShopProductResponse(
				product.getId(),
				product.getName(),
				product.getDescription(),
				product.getCategory(),
				product.getBrand(),
				product.getImageUrl(),
				product.getPriceMinor(),
				product.getStock()
		);
	}
}
