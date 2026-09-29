package com.example.fixflow.dto;

import java.util.List;

public record ShopCatalogResponse(
		String currency,
		int minorUnitDigits,
		List<ShopProductResponse> products
) {
}
