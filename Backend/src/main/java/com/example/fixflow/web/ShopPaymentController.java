package com.example.fixflow.web;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.fixflow.dto.ShopOrderResponse;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.service.ShopPaymentService;

@RestController
@RequestMapping("/api/shop/payments")
public class ShopPaymentController {

	private final ShopPaymentService shopPaymentService;

	public ShopPaymentController(ShopPaymentService shopPaymentService) {
		this.shopPaymentService = shopPaymentService;
	}

	@PostMapping("/dev/complete/{publicId}")
	public ShopOrderResponse completeDev(
			@PathVariable String publicId,
			@AuthenticationPrincipal AppUserDetails principal
	) {
		return shopPaymentService.completeDevPayment(publicId, principal);
	}
}
