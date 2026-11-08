package com.example.fixflow.repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.example.fixflow.domain.ShopOrder;
import com.example.fixflow.domain.ShopOrderStatus;

public interface ShopOrderRepository extends JpaRepository<ShopOrder, Long> {

	@EntityGraph(attributePaths = { "items", "payment", "user" })
	Optional<ShopOrder> findByPublicId(String publicId);

	@EntityGraph(attributePaths = { "items", "payment", "user" })
	Optional<ShopOrder> findByUserIdAndIdempotencyKey(Long userId, String idempotencyKey);

	@EntityGraph(attributePaths = { "items", "payment", "user" })
	List<ShopOrder> findByUserIdOrderByCreatedAtDesc(Long userId);

	@EntityGraph(attributePaths = { "items", "payment", "user" })
	Optional<ShopOrder> findByPublicIdAndUserId(String publicId, Long userId);
	org.springframework.data.domain.Slice<ShopOrder> findAllByOrderByCreatedAtDescIdDesc(org.springframework.data.domain.Pageable pageable);

	@Query("select o.status, count(o) from ShopOrder o group by o.status")
	List<Object[]> countByStatus();

	@Query("select o.currency, o.minorUnitDigits, sum(o.totalMinor) from ShopOrder o where o.status in :statuses group by o.currency, o.minorUnitDigits")
	List<Object[]> revenue(@Param("statuses") List<ShopOrderStatus> statuses);

	@Query("select year(o.createdAt), month(o.createdAt), day(o.createdAt), o.status, o.currency, o.minorUnitDigits, count(o), sum(o.totalMinor) from ShopOrder o where o.createdAt >= :start and o.createdAt < :end group by year(o.createdAt), month(o.createdAt), day(o.createdAt), o.status, o.currency, o.minorUnitDigits")
	List<Object[]> dailyGroups(@Param("start") Instant start, @Param("end") Instant end);
}
