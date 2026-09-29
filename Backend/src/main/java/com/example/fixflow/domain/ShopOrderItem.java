package com.example.fixflow.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "shop_order_items")
@Getter
@Setter
@NoArgsConstructor
public class ShopOrderItem {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "order_id", nullable = false)
	private ShopOrder order;

	@Column(name = "product_id", nullable = false, length = 64)
	private String productId;

	@Column(nullable = false)
	private String name;

	@Column(name = "unit_price_minor", nullable = false)
	private int unitPriceMinor;

	@Column(nullable = false)
	private int quantity;
}
