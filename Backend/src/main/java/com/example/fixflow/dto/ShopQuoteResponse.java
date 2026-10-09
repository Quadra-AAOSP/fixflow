package com.example.fixflow.dto;

import java.util.List;

public record ShopQuoteResponse(
		String currency,
		int minorUnitDigits,
		List<ShopQuoteLineResponse> lines,
		int subtotalMinor,
		int shippingMinor,
		int taxMinor,
		int totalMinor
) {
}
