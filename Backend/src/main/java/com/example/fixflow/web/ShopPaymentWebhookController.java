package com.example.fixflow.web;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.fixflow.dto.ShopOrderResponse;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.service.ShopPaymentService;

@RestController
@RequestMapping("/api/shop/payments")
public class ShopPaymentWebhookController {

	private final ShopPaymentService shopPaymentService;

	public ShopPaymentWebhookController(ShopPaymentService shopPaymentService) {
		this.shopPaymentService = shopPaymentService;
	}

	@PostMapping("/webhook")
	public ResponseEntity<Void> stripeWebhook(
			@RequestBody String payload,
			@RequestHeader(value = "Stripe-Signature", required = false) String signature
	) {
		shopPaymentService.handleStripeWebhook(payload, signature);
		return ResponseEntity.ok().build();
	}

	@PostMapping("/dev/complete/{publicId}")
	public ShopOrderResponse completeDev(
			@PathVariable String publicId,
			@AuthenticationPrincipal AppUserDetails principal
	) {
		return shopPaymentService.completeDevPayment(publicId, principal);
	}
}
