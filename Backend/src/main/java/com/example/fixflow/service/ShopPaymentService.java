package com.example.fixflow.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.fixflow.domain.ShopOrder;
import com.example.fixflow.domain.ShopOrderStatus;
import com.example.fixflow.domain.ShopPaymentProvider;
import com.example.fixflow.dto.ShopOrderResponse;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.web.ApiException;

@Service
public class ShopPaymentService {

	private final ShopOrderService shopOrderService;

	public ShopPaymentService(ShopOrderService shopOrderService) {
		this.shopOrderService = shopOrderService;
	}

	@Transactional
	public ShopOrderResponse completeDevPayment(String publicId, AppUserDetails principal) {
		if (principal == null) {
			throw new ApiException(401, "Authentication required");
		}
		if (principal.getRole() == com.example.fixflow.domain.UserRole.shop_manager) {
			throw new ApiException(403, "Shop managers cannot purchase");
		}
		ShopOrder order = shopOrderService.requireByPublicId(publicId);
		if (!order.getUser().getId().equals(principal.getId())) {
			throw new ApiException(403, "Not your order");
		}
		if (order.getPayment() == null || order.getPayment().getProvider() != ShopPaymentProvider.dev) {
			throw new ApiException(400, "Simulated payment is only available for local checkout sessions");
		}
		if (order.getStatus() != ShopOrderStatus.pending_payment) {
			return ShopOrderResponse.from(order);
		}
		shopOrderService.markPaid(order, "{\"provider\":\"dev\",\"status\":\"succeeded\"}");
		return ShopOrderResponse.from(shopOrderService.requireByPublicId(publicId));
	}
}
