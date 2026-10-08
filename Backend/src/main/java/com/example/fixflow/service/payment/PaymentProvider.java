package com.example.fixflow.service.payment;

import com.example.fixflow.domain.ShopOrder;
import com.example.fixflow.domain.ShopPaymentProvider;

public interface PaymentProvider {

	ShopPaymentProvider type();

	PaymentSession createCheckoutSession(ShopOrder order);

	void cancelSession(String providerRef);

	record PaymentSession(String providerRef, String checkoutUrl) {
	}
}
