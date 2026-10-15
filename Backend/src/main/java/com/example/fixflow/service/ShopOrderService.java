package com.example.fixflow.service;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.fixflow.config.ShopProperties;
import com.example.fixflow.domain.ShopOrder;
import com.example.fixflow.domain.ShopOrderItem;
import com.example.fixflow.domain.ShopOrderStatus;
import com.example.fixflow.domain.ShopPayment;
import com.example.fixflow.domain.ShopPaymentProvider;
import com.example.fixflow.domain.ShopPaymentStatus;
import com.example.fixflow.domain.User;
import com.example.fixflow.dto.ShopCreateOrderRequest;
import com.example.fixflow.dto.ShopCreateOrderResponse;
import com.example.fixflow.dto.ShopOrderResponse;
import com.example.fixflow.dto.ShopQuoteRequest;
import com.example.fixflow.dto.ShopQuoteResponse;
import com.example.fixflow.repository.ShopOrderRepository;
import com.example.fixflow.repository.ShopProductRepository;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.service.payment.PaymentProvider;
import com.example.fixflow.service.payment.PaymentProvider.PaymentSession;
import com.example.fixflow.web.ApiException;

import jakarta.persistence.EntityManager;

@Service
public class ShopOrderService {

	private final ShopCatalogService shopCatalogService;
	private final ShopOrderRepository shopOrderRepository;
	private final ShopProductRepository shopProductRepository;
	private final PaymentProvider paymentProvider;
	private final EntityManager entityManager;

	public ShopOrderService(
			ShopCatalogService shopCatalogService,
			ShopOrderRepository shopOrderRepository,
			ShopProductRepository shopProductRepository,
			ShopProperties shopProperties,
			List<PaymentProvider> paymentProviders,
			EntityManager entityManager
	) {
		this.shopCatalogService = shopCatalogService;
		this.shopOrderRepository = shopOrderRepository;
		this.shopProductRepository = shopProductRepository;
		this.paymentProvider = selectProvider(paymentProviders, shopProperties);
		this.entityManager = entityManager;
	}

	@Transactional(readOnly = true)
	public ShopQuoteResponse quote(ShopQuoteRequest request, AppUserDetails principal) {
		requireAuth(principal);
		return shopCatalogService.priceCart(request.items()).quote();
	}

	@Transactional
	public ShopCreateOrderResponse create(ShopCreateOrderRequest request, String idempotencyKey, AppUserDetails principal) {
		requireAuth(principal);
		if (idempotencyKey == null || idempotencyKey.isBlank()) {
			throw new ApiException(400, "Idempotency-Key header is required");
		}
		Long userId = principal.getId();
		return shopOrderRepository.findByUserIdAndIdempotencyKey(userId, idempotencyKey.trim())
				.map(this::toCreateResponse)
				.orElseGet(() -> createNewOrder(request, idempotencyKey.trim(), userId));
	}

	@Transactional(readOnly = true)
	public List<ShopOrderResponse> listMine(AppUserDetails principal) {
		requireAuth(principal);
		return shopOrderRepository.findByUserIdOrderByCreatedAtDesc(principal.getId()).stream()
				.map(ShopOrderResponse::from)
				.toList();
	}

	@Transactional(readOnly = true)
	public ShopOrderResponse getMine(String publicId, AppUserDetails principal) {
		requireAuth(principal);
		return ShopOrderResponse.from(requireOwnedOrder(publicId, principal.getId()));
	}

	@Transactional
	public ShopOrderResponse cancel(String publicId, AppUserDetails principal) {
		requireAuth(principal);
		ShopOrder order = lockOrder(requireOwnedOrder(publicId, principal.getId()));
		if (order.getStatus() != ShopOrderStatus.pending_payment) {
			throw new ApiException(409, "Only pending payment orders can be cancelled");
		}
		restoreStock(order);
		order.setStatus(ShopOrderStatus.cancelled);
		if (order.getPayment() != null) {
			order.getPayment().setStatus(ShopPaymentStatus.cancelled);
			paymentProvider.cancelSession(order.getPayment().getProviderRef());
		}
		return ShopOrderResponse.from(shopOrderRepository.save(order));
	}

	@Transactional
	public void markPaid(ShopOrder order, String rawEvent) {
		order = lockOrder(order);
		if (order.getStatus() == ShopOrderStatus.paid) {
			return;
		}
		if (order.getStatus() != ShopOrderStatus.pending_payment) {
			throw new ApiException(409, "Order cannot be marked paid from status " + order.getStatus());
		}
		order.setStatus(ShopOrderStatus.paid);
		if (order.getPayment() != null) {
			order.getPayment().setStatus(ShopPaymentStatus.succeeded);
			if (rawEvent != null) {
				order.getPayment().setRawEvent(rawEvent);
			}
		}
		shopOrderRepository.save(order);
	}

	@Transactional
	public void markFailed(ShopOrder order, String rawEvent) {
		order = lockOrder(order);
		if (order.getStatus() != ShopOrderStatus.pending_payment) {
			return;
		}
		restoreStock(order);
		order.setStatus(ShopOrderStatus.cancelled);
		if (order.getPayment() != null) {
			order.getPayment().setStatus(ShopPaymentStatus.failed);
			if (rawEvent != null) {
				order.getPayment().setRawEvent(rawEvent);
			}
		}
		shopOrderRepository.save(order);
	}

	@Transactional(readOnly = true)
	public ShopOrder requireByPublicId(String publicId) {
		return shopOrderRepository.findByPublicId(publicId)
				.orElseThrow(() -> new ApiException(404, "Order not found"));
	}

	private ShopCreateOrderResponse createNewOrder(ShopCreateOrderRequest request, String idempotencyKey, Long userId) {
		ShopCatalogService.PricedCart priced = shopCatalogService.priceCart(request.items());
		ShopQuoteResponse quote = priced.quote();

		ShopOrder order = new ShopOrder();
		order.setPublicId(UUID.randomUUID().toString());
		order.setUser(entityManager.getReference(User.class, userId));
		order.setStatus(ShopOrderStatus.pending_payment);
		order.setCurrency(quote.currency());
		order.setMinorUnitDigits(quote.minorUnitDigits());
		order.setSubtotalMinor(quote.subtotalMinor());
		order.setShippingMinor(quote.shippingMinor());
		order.setTaxMinor(quote.taxMinor());
		order.setTotalMinor(quote.totalMinor());
		order.setShippingName(request.shippingName().trim());
		order.setShippingPhone(blankToNull(request.shippingPhone()));
		order.setShippingAddress(request.shippingAddress().trim());
		order.setIdempotencyKey(idempotencyKey);

		for (var line : quote.lines().stream().sorted(java.util.Comparator.comparing(
				com.example.fixflow.dto.ShopQuoteLineResponse::productId)).toList()) {
			if (shopProductRepository.reserveStock(line.productId(), line.quantity(), java.time.Instant.now()) != 1) {
				throw new ApiException(409, "Insufficient stock for " + line.name());
			}

			ShopOrderItem item = new ShopOrderItem();
			item.setProductId(line.productId());
			item.setName(line.name());
			item.setUnitPriceMinor(line.unitPriceMinor());
			item.setQuantity(line.quantity());
			order.addItem(item);
		}

		ShopPayment payment = new ShopPayment();
		payment.setOrder(order);
		payment.setProvider(paymentProvider.type());
		payment.setStatus(ShopPaymentStatus.requires_action);
		order.setPayment(payment);

		ShopOrder saved = shopOrderRepository.save(order);
		entityManager.flush();

		PaymentSession session = paymentProvider.createCheckoutSession(saved);
		saved.getPayment().setProviderRef(session.providerRef());
		saved.getPayment().setCheckoutUrl(session.checkoutUrl());
		saved = shopOrderRepository.save(saved);

		return toCreateResponse(saved);
	}

	private void restoreStock(ShopOrder order) {
		for (ShopOrderItem item : order.getItems().stream().sorted(
				java.util.Comparator.comparing(ShopOrderItem::getProductId)).toList()) {
			shopProductRepository.restoreStock(item.getProductId(), item.getQuantity(), java.time.Instant.now());
		}
	}

	private ShopOrder lockOrder(ShopOrder order) {
		ShopOrder managed = entityManager.find(ShopOrder.class, order.getId());
		// Read current state under a database lock, not a potentially stale entity
		// already loaded by a payment callback in this transaction.
		Object status = entityManager.createNativeQuery(
				"select status from shop_orders where id = ?1 for update", String.class)
				.setParameter(1, order.getId()).getSingleResult();
		managed.setStatus(ShopOrderStatus.valueOf(status.toString()));
		return managed;
	}

	private ShopOrder requireOwnedOrder(String publicId, Long userId) {
		return shopOrderRepository.findByPublicIdAndUserId(publicId, userId)
				.orElseThrow(() -> new ApiException(404, "Order not found"));
	}

	private ShopCreateOrderResponse toCreateResponse(ShopOrder order) {
		String checkoutUrl = order.getPayment() != null ? order.getPayment().getCheckoutUrl() : null;
		String provider = order.getPayment() != null ? order.getPayment().getProvider().name() : null;
		return new ShopCreateOrderResponse(order.getPublicId(), order.getTotalMinor(), checkoutUrl, provider);
	}

	private static PaymentProvider selectProvider(List<PaymentProvider> providers, ShopProperties properties) {
		ShopPaymentProvider wanted = properties.stripeEnabled() ? ShopPaymentProvider.stripe : ShopPaymentProvider.dev;
		return providers.stream()
				.filter(p -> p.type() == wanted)
				.findFirst()
				.orElseThrow(() -> new IllegalStateException("No payment provider for " + wanted));
	}

	private static void requireAuth(AppUserDetails principal) {
		if (principal == null) {
			throw new ApiException(401, "Authentication required");
		}
	}

	private static String blankToNull(String value) {
		return value == null || value.isBlank() ? null : value.trim();
	}
}
