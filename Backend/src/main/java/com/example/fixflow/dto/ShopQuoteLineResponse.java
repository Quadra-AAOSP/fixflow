package com.example.fixflow.dto;

public record ShopQuoteLineResponse(
		String productId,
		String name,
		int unitPriceMinor,
		int quantity,
		int lineTotalMinor,
		int availableStock
) {
}
