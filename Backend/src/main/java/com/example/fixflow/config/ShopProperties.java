package com.example.fixflow.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "fixflow.shop")
public record ShopProperties(
		String currency,
		int minorUnitDigits,
		int flatShippingMinor,
		String checkoutSuccessUrl,
		String checkoutCancelUrl,
		String stripeSecretKey,
		String stripeWebhookSecret
) {
	public boolean stripeEnabled() {
		return stripeSecretKey != null && !stripeSecretKey.isBlank();
	}
}
