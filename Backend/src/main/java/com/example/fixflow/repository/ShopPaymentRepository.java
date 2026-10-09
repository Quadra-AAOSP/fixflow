package com.example.fixflow.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.fixflow.domain.ShopPayment;

public interface ShopPaymentRepository extends JpaRepository<ShopPayment, Long> {

	Optional<ShopPayment> findByProviderRef(String providerRef);

	Optional<ShopPayment> findByOrderId(Long orderId);
}
