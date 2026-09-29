package com.example.fixflow.domain;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "shop_orders")
@Getter
@Setter
@NoArgsConstructor
public class ShopOrder {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(name = "public_id", nullable = false, unique = true, length = 36)
	private String publicId;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "user_id", nullable = false)
	private User user;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 32)
	private ShopOrderStatus status = ShopOrderStatus.pending_payment;

	@Column(nullable = false, length = 3)
	private String currency;

	@Column(name = "minor_unit_digits", nullable = false)
	private int minorUnitDigits;

	@Column(name = "subtotal_minor", nullable = false)
	private int subtotalMinor;

	@Column(name = "shipping_minor", nullable = false)
	private int shippingMinor;

	@Column(name = "tax_minor", nullable = false)
	private int taxMinor;

	@Column(name = "total_minor", nullable = false)
	private int totalMinor;

	@Column(name = "shipping_name", nullable = false)
	private String shippingName;

	@Column(name = "shipping_phone", length = 64)
	private String shippingPhone;

	@Column(name = "shipping_address", nullable = false, length = 512)
	private String shippingAddress;

	@Column(name = "idempotency_key", nullable = false, length = 128)
	private String idempotencyKey;

	@OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
	private List<ShopOrderItem> items = new ArrayList<>();

	@OneToOne(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
	private ShopPayment payment;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	@PrePersist
	void onCreate() {
		Instant now = Instant.now();
		createdAt = now;
		updatedAt = now;
		if (status == null) {
			status = ShopOrderStatus.pending_payment;
		}
	}

	@PreUpdate
	void onUpdate() {
		updatedAt = Instant.now();
	}

	public void addItem(ShopOrderItem item) {
		items.add(item);
		item.setOrder(this);
	}
}
