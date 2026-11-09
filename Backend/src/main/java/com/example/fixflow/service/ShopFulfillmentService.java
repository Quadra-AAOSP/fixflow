package com.example.fixflow.service;

import java.time.Instant;
import java.util.List;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.example.fixflow.domain.ShopFulfillmentStatus;
import com.example.fixflow.domain.ShopNotification;
import com.example.fixflow.domain.ShopOrder;
import com.example.fixflow.domain.ShopOrderStatus;
import com.example.fixflow.domain.UserRole;
import com.example.fixflow.dto.ShopOrderItemResponse;
import com.example.fixflow.dto.ShopOrderResponse;
import com.example.fixflow.repository.ShopNotificationRepository;
import com.example.fixflow.repository.ShopOrderRepository;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.web.ApiException;
import jakarta.persistence.EntityManager;

@Service
public class ShopFulfillmentService {
	private final ShopOrderRepository orders;
	private final ShopNotificationRepository notices;
	private final EntityManager entityManager;

	public ShopFulfillmentService(ShopOrderRepository orders, ShopNotificationRepository notices, EntityManager entityManager) {
		this.orders = orders;
		this.notices = notices;
		this.entityManager = entityManager;
	}

	public record Inbox<T>(List<T> content, boolean hasMore) { }
	public record AdminOrder(String orderId, ShopOrderStatus status, String currency, int minorUnitDigits,
			List<ShopOrderItemResponse> items, int subtotalMinor, int shippingMinor, int taxMinor, int totalMinor,
			String shippingName, String shippingPhone, String shippingAddress, com.example.fixflow.domain.ShopPaymentStatus paymentStatus,
			Instant createdAt, Instant updatedAt, ShopFulfillmentStatus fulfillmentStatus, Instant processingAt,
			Instant shippedAt, Instant deliveryConfirmedAt, String deliverySignedName, List<String> allowedTransitions) { }
	public record Notice(Long id, String orderId, String type, Instant createdAt) { }

	@Transactional(readOnly = true)
	public Inbox<AdminOrder> list(int page, AppUserDetails principal) {
		requireManager(principal);
		if (page < 0) throw new ApiException(400, "page must be non-negative");
		var result = orders.findAllByOrderByCreatedAtDescIdDesc(PageRequest.of(page, 20));
		return new Inbox<>(result.map(order -> admin(find(order.getPublicId()))).getContent(), result.hasNext());
	}
	@Transactional(readOnly = true)
	public AdminOrder get(String id, AppUserDetails principal) {
		requireManager(principal);
		return admin(find(id));
	}
	@Transactional
	public AdminOrder advance(String id, String target, AppUserDetails principal) {
		requireManager(principal);
		ShopOrder order = locked(id);
		ShopFulfillmentStatus next;
		try { next = ShopFulfillmentStatus.valueOf(target); }
		catch (RuntimeException ex) { throw new ApiException(400, "Invalid fulfillment status"); }
		if (order.getStatus() != ShopOrderStatus.paid) throw new ApiException(409, "Order is not paid");
		if (order.getFulfillmentStatus() == next && (next == ShopFulfillmentStatus.processing || next == ShopFulfillmentStatus.shipped)) return admin(order);
		Instant now = Instant.now();
		if (order.getFulfillmentStatus() == ShopFulfillmentStatus.ordered && next == ShopFulfillmentStatus.processing) {
			order.setProcessingAt(now);
		} else if (order.getFulfillmentStatus() == ShopFulfillmentStatus.processing && next == ShopFulfillmentStatus.shipped) {
			order.setShippedAt(now);
			notices.save(new ShopNotification(order.getUser().getId(), order.getPublicId(), "order_shipped", now));
		} else throw new ApiException(409, "Invalid fulfillment transition");
		order.setFulfillmentStatus(next);
		return admin(order);
	}
	@Transactional
	public ShopOrderResponse confirm(String id, String signedName, Boolean received, AppUserDetails principal) {
		if (principal == null) throw new ApiException(401, "Authentication required");
		if (signedName == null || signedName.isBlank() || signedName.trim().length() > 160 || !Boolean.TRUE.equals(received)) throw new ApiException(400, "Name and receipt confirmation required");
		ShopOrder order = locked(id);
		if (!order.getUser().getId().equals(principal.getId())) throw new ApiException(404, "Order not found");
		String name = signedName.trim();
		if (order.getFulfillmentStatus() == ShopFulfillmentStatus.delivered) {
			if (name.equals(order.getDeliverySignedName()) && principal.getId().equals(order.getDeliveryConfirmedBy())) return ShopOrderResponse.from(order);
			throw new ApiException(409, "Receipt already confirmed");
		}
		if (order.getStatus() != ShopOrderStatus.paid || order.getFulfillmentStatus() != ShopFulfillmentStatus.shipped) throw new ApiException(409, "Order is not shipped");
		order.setDeliverySignedName(name);
		order.setDeliveryConfirmedBy(principal.getId());
		order.setDeliveryConfirmedAt(Instant.now());
		order.setFulfillmentStatus(ShopFulfillmentStatus.delivered);
		order.setStatus(ShopOrderStatus.fulfilled);
		return ShopOrderResponse.from(order);
	}
	@Transactional(readOnly = true)
	public Inbox<Notice> notifications(int page, AppUserDetails principal) {
		if (principal == null) throw new ApiException(401, "Authentication required");
		if (page < 0) throw new ApiException(400, "page must be non-negative");
		var result = notices.findByRecipientIdOrderByIdDesc(principal.getId(), PageRequest.of(page, 20));
		return new Inbox<>(result.map(n -> new Notice(n.getId(), n.getOrderId(), n.getType(), n.getCreatedAt())).getContent(), result.hasNext());
	}
	private ShopOrder find(String id) { return orders.findByPublicId(id).orElseThrow(() -> new ApiException(404, "Order not found")); }
	private ShopOrder locked(String id) {
		return ShopOrderLock.reload(entityManager, find(id));
	}
	private static void requireManager(AppUserDetails principal) {
		if (principal == null) throw new ApiException(401, "Authentication required");
		if (principal.getRole() != UserRole.shop_manager && principal.getRole() != UserRole.super_admin) throw new ApiException(403, "Shop manager access required");
	}
	private AdminOrder admin(ShopOrder order) {
		ShopOrderResponse r = ShopOrderResponse.from(order);
		List<String> next = order.getStatus() != ShopOrderStatus.paid ? List.of() :
				order.getFulfillmentStatus() == ShopFulfillmentStatus.ordered ? List.of("processing") :
				order.getFulfillmentStatus() == ShopFulfillmentStatus.processing ? List.of("shipped") : List.of();
		return new AdminOrder(r.orderId(), r.status(), r.currency(), r.minorUnitDigits(), r.items(), r.subtotalMinor(), r.shippingMinor(), r.taxMinor(), r.totalMinor(), r.shippingName(), r.shippingPhone(), r.shippingAddress(), r.paymentStatus(), r.createdAt(), r.updatedAt(), r.fulfillmentStatus(), r.processingAt(), r.shippedAt(), r.deliveryConfirmedAt(), r.deliverySignedName(), next);
	}
}
