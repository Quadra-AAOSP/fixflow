package com.example.fixflow.dto;

public record ShopOrderItemResponse(
		String productId,
		String name,
		int unitPriceMinor,
		int quantity,
		int lineTotalMinor
) {
}
