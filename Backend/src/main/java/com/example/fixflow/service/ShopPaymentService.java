package com.example.fixflow.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.fixflow.config.ShopProperties;
import com.example.fixflow.domain.ShopOrder;
import com.example.fixflow.domain.ShopOrderStatus;
import com.example.fixflow.domain.ShopPayment;
import com.example.fixflow.domain.ShopPaymentProvider;
import com.example.fixflow.domain.ShopPaymentStatus;
import com.example.fixflow.dto.ShopOrderResponse;
import com.example.fixflow.repository.ShopPaymentRepository;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.web.ApiException;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Event;
import com.stripe.model.checkout.Session;
import com.stripe.net.Webhook;

@Service
public class ShopPaymentService {

	private final ShopOrderService shopOrderService;
	private final ShopPaymentRepository shopPaymentRepository;
	private final ShopProperties shopProperties;

	public ShopPaymentService(
			ShopOrderService shopOrderService,
			ShopPaymentRepository shopPaymentRepository,
			ShopProperties shopProperties
	) {
		this.shopOrderService = shopOrderService;
		this.shopPaymentRepository = shopPaymentRepository;
		this.shopProperties = shopProperties;
	}

	@Transactional
	public ShopOrderResponse completeDevPayment(String publicId, AppUserDetails principal) {
		if (principal == null) {
			throw new ApiException(401, "Authentication required");
		}
		ShopOrder order = shopOrderService.requireByPublicId(publicId);
		if (!order.getUser().getId().equals(principal.getId())) {
			throw new ApiException(403, "Not your order");
		}
		if (order.getPayment() == null || order.getPayment().getProvider() != ShopPaymentProvider.dev) {
			throw new ApiException(400, "Dev payment is only available for local checkout sessions");
		}
		if (order.getStatus() != ShopOrderStatus.pending_payment) {
			return ShopOrderResponse.from(order);
		}
		shopOrderService.markPaid(order, "{\"provider\":\"dev\",\"status\":\"succeeded\"}");
		return ShopOrderResponse.from(shopOrderService.requireByPublicId(publicId));
	}

	@Transactional
	public void handleStripeWebhook(String payload, String signatureHeader) {
		if (!shopProperties.stripeEnabled()) {
			throw new ApiException(400, "Stripe is not configured");
		}
		String secret = shopProperties.stripeWebhookSecret();
		if (secret == null || secret.isBlank()) {
			throw new ApiException(500, "Stripe webhook secret is not configured");
		}
		Event event;
		try {
			event = Webhook.constructEvent(payload, signatureHeader, secret);
		}
		catch (SignatureVerificationException ex) {
			throw new ApiException(400, "Invalid Stripe signature");
		}

		if ("checkout.session.completed".equals(event.getType())
				|| "checkout.session.async_payment_succeeded".equals(event.getType())) {
			Session session = (Session) event.getDataObjectDeserializer()
					.getObject()
					.orElse(null);
			if (session == null) {
				return;
			}
			ShopPayment payment = shopPaymentRepository.findByProviderRef(session.getId()).orElse(null);
			if (payment == null) {
				return;
			}
			shopOrderService.markPaid(payment.getOrder(), payload);
		}
		else if ("checkout.session.expired".equals(event.getType())
				|| "checkout.session.async_payment_failed".equals(event.getType())) {
			Session session = (Session) event.getDataObjectDeserializer()
					.getObject()
					.orElse(null);
			if (session == null) {
				return;
			}
			ShopPayment payment = shopPaymentRepository.findByProviderRef(session.getId()).orElse(null);
			if (payment == null || payment.getStatus() == ShopPaymentStatus.succeeded) {
				return;
			}
			shopOrderService.markFailed(payment.getOrder(), payload);
		}
	}
}
