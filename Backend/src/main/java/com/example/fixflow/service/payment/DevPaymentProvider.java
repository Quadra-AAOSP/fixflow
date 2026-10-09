package com.example.fixflow.service.payment;

import org.springframework.stereotype.Component;

import com.example.fixflow.config.ShopProperties;
import com.example.fixflow.domain.ShopOrder;
import com.example.fixflow.domain.ShopPaymentProvider;

@Component
public class DevPaymentProvider implements PaymentProvider {

	private final ShopProperties shopProperties;

	public DevPaymentProvider(ShopProperties shopProperties) {
		this.shopProperties = shopProperties;
	}

	@Override
	public ShopPaymentProvider type() {
		return ShopPaymentProvider.dev;
	}

	@Override
	public PaymentSession createCheckoutSession(ShopOrder order) {
		String base = shopProperties.checkoutSuccessUrl();
		String separator = base.contains("?") ? "&" : "?";
		String url = base + separator + "orderId=" + order.getPublicId() + "&devPay=1";
		return new PaymentSession("dev_" + order.getPublicId(), url);
	}

	@Override
	public void cancelSession(String providerRef) {
		// no-op for local demo provider
	}
}
