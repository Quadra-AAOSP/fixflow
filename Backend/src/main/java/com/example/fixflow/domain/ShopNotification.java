package com.example.fixflow.domain;

import java.time.Instant;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "shop_notifications", uniqueConstraints = @UniqueConstraint(columnNames = {"recipient_id", "order_id", "type"}))
@Getter
@NoArgsConstructor
public class ShopNotification {
	@Id @GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;
	@Column(name = "recipient_id", nullable = false)
	private Long recipientId;
	@Column(name = "order_id", nullable = false, length = 36)
	private String orderId;
	@Column(nullable = false, length = 32)
	private String type;
	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	public ShopNotification(Long recipientId, String orderId, String type, Instant createdAt) {
		this.recipientId = recipientId;
		this.orderId = orderId;
		this.type = type;
		this.createdAt = createdAt;
	}
}
