package com.example.fixflow.dto;

import java.time.Instant;
import java.util.List;

import com.example.fixflow.domain.ShopOrder;
import com.example.fixflow.domain.ShopOrderStatus;
import com.example.fixflow.domain.ShopPaymentStatus;

public record ShopOrderResponse(
		String orderId,
		ShopOrderStatus status,
		String currency,
		int minorUnitDigits,
		List<ShopOrderItemResponse> items,
		int subtotalMinor,
		int shippingMinor,
		int taxMinor,
		int totalMinor,
		String shippingName,
		String shippingPhone,
		String shippingAddress,
		String checkoutUrl,
		ShopPaymentStatus paymentStatus,
		Instant createdAt,
		Instant updatedAt
) {
	public static ShopOrderResponse from(ShopOrder order) {
		List<ShopOrderItemResponse> items = order.getItems().stream()
				.map(item -> new ShopOrderItemResponse(
						item.getProductId(),
						item.getName(),
						item.getUnitPriceMinor(),
						item.getQuantity(),
						item.getUnitPriceMinor() * item.getQuantity()
				))
				.toList();
		String checkoutUrl = order.getPayment() != null ? order.getPayment().getCheckoutUrl() : null;
		ShopPaymentStatus paymentStatus = order.getPayment() != null ? order.getPayment().getStatus() : null;
		return new ShopOrderResponse(
				order.getPublicId(),
				order.getStatus(),
				order.getCurrency(),
				order.getMinorUnitDigits(),
				items,
				order.getSubtotalMinor(),
				order.getShippingMinor(),
				order.getTaxMinor(),
				order.getTotalMinor(),
				order.getShippingName(),
				order.getShippingPhone(),
				order.getShippingAddress(),
				checkoutUrl,
				paymentStatus,
				order.getCreatedAt(),
				order.getUpdatedAt()
		);
	}
}
