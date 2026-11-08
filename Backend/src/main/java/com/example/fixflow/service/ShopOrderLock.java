package com.example.fixflow.service;

import com.example.fixflow.domain.ShopOrder;
import jakarta.persistence.EntityManager;

final class ShopOrderLock {
	private ShopOrderLock() { }

	static ShopOrder reload(EntityManager entityManager, ShopOrder order) {
		Long id = order.getId();
		entityManager.detach(order);
		return (ShopOrder) entityManager.createNativeQuery(
				"select * from shop_orders where id = ?1 for update", ShopOrder.class)
				.setParameter(1, id).getSingleResult();
	}
}
