package com.example.fixflow.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import com.example.fixflow.domain.ShopOrder;

public interface ShopOrderRepository extends JpaRepository<ShopOrder, Long> {

	@EntityGraph(attributePaths = { "items", "payment", "user" })
	Optional<ShopOrder> findByPublicId(String publicId);

	@EntityGraph(attributePaths = { "items", "payment", "user" })
	Optional<ShopOrder> findByUserIdAndIdempotencyKey(Long userId, String idempotencyKey);

	@EntityGraph(attributePaths = { "items", "payment", "user" })
	List<ShopOrder> findByUserIdOrderByCreatedAtDesc(Long userId);

	@EntityGraph(attributePaths = { "items", "payment", "user" })
	Optional<ShopOrder> findByPublicIdAndUserId(String publicId, Long userId);
}
