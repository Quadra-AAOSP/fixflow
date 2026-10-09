package com.example.fixflow.domain;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "shop_payments")
@Getter
@Setter
@NoArgsConstructor
public class ShopPayment {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@OneToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "order_id", nullable = false, unique = true)
	private ShopOrder order;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 16)
	private ShopPaymentProvider provider;

	@Column(name = "provider_ref", length = 255)
	private String providerRef;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 32)
	private ShopPaymentStatus status = ShopPaymentStatus.requires_action;

	@Column(name = "checkout_url", length = 2048)
	private String checkoutUrl;

	@Column(name = "raw_event", columnDefinition = "TEXT")
	private String rawEvent;

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
			status = ShopPaymentStatus.requires_action;
		}
	}

	@PreUpdate
	void onUpdate() {
		updatedAt = Instant.now();
	}
}
