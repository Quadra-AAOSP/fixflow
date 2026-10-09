package com.example.fixflow.dto;

public record ShopCreateOrderResponse(
		String orderId,
		int totalMinor,
		String checkoutUrl,
		String paymentProvider
) {
}
