package com.example.fixflow.service.payment;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

import com.example.fixflow.config.ShopProperties;
import com.example.fixflow.domain.ShopOrder;
import com.example.fixflow.domain.ShopOrderItem;
import com.example.fixflow.domain.ShopPaymentProvider;
import com.example.fixflow.web.ApiException;
import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import com.stripe.param.checkout.SessionCreateParams;
import com.stripe.param.checkout.SessionExpireParams;

@Component
public class StripeCheckoutPaymentProvider implements PaymentProvider {

	private final ShopProperties shopProperties;

	public StripeCheckoutPaymentProvider(ShopProperties shopProperties) {
		this.shopProperties = shopProperties;
	}

	@Override
	public ShopPaymentProvider type() {
		return ShopPaymentProvider.stripe;
	}

	@Override
	public PaymentSession createCheckoutSession(ShopOrder order) {
		ensureConfigured();
		try {
			List<SessionCreateParams.LineItem> lineItems = new ArrayList<>();
			for (ShopOrderItem item : order.getItems()) {
				lineItems.add(SessionCreateParams.LineItem.builder()
						.setQuantity((long) item.getQuantity())
						.setPriceData(SessionCreateParams.LineItem.PriceData.builder()
								.setCurrency(order.getCurrency().toLowerCase())
								.setUnitAmount((long) item.getUnitPriceMinor())
								.setProductData(SessionCreateParams.LineItem.PriceData.ProductData.builder()
										.setName(item.getName())
										.build())
								.build())
						.build());
			}
			if (order.getShippingMinor() > 0) {
				lineItems.add(SessionCreateParams.LineItem.builder()
						.setQuantity(1L)
						.setPriceData(SessionCreateParams.LineItem.PriceData.builder()
								.setCurrency(order.getCurrency().toLowerCase())
								.setUnitAmount((long) order.getShippingMinor())
								.setProductData(SessionCreateParams.LineItem.PriceData.ProductData.builder()
										.setName("Shipping")
										.build())
								.build())
						.build());
			}

			Map<String, String> metadata = new HashMap<>();
			metadata.put("orderPublicId", order.getPublicId());

			SessionCreateParams params = SessionCreateParams.builder()
					.setMode(SessionCreateParams.Mode.PAYMENT)
					.setSuccessUrl(shopProperties.checkoutSuccessUrl()
							+ (shopProperties.checkoutSuccessUrl().contains("?") ? "&" : "?")
							+ "orderId=" + order.getPublicId())
					.setCancelUrl(shopProperties.checkoutCancelUrl()
							+ (shopProperties.checkoutCancelUrl().contains("?") ? "&" : "?")
							+ "orderId=" + order.getPublicId())
					.putAllMetadata(metadata)
					.addAllLineItem(lineItems)
					.build();

			Session session = Session.create(params);
			return new PaymentSession(session.getId(), session.getUrl());
		}
		catch (StripeException ex) {
			throw new ApiException(502, "Unable to start Stripe checkout: " + ex.getMessage());
		}
	}

	@Override
	public void cancelSession(String providerRef) {
		if (providerRef == null || providerRef.isBlank() || !shopProperties.stripeEnabled()) {
			return;
		}
		ensureConfigured();
		try {
			Session session = Session.retrieve(providerRef);
			session.expire(SessionExpireParams.builder().build());
		}
		catch (StripeException ignored) {
			// best-effort cancel
		}
	}

	private void ensureConfigured() {
		if (!shopProperties.stripeEnabled()) {
			throw new ApiException(500, "Stripe is not configured");
		}
		Stripe.apiKey = shopProperties.stripeSecretKey();
	}
}
