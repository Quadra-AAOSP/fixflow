package com.example.fixflow.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.example.fixflow.domain.ShopProduct;

public interface ShopProductRepository extends JpaRepository<ShopProduct, String> {

	List<ShopProduct> findByActiveTrueOrderByNameAsc();

	boolean existsById(String id);

	@Modifying(flushAutomatically = true)
	@Query("update ShopProduct p set p.stock = p.stock - :quantity, p.updatedAt = :now "
			+ "where p.id = :id and p.active = true and :quantity > 0 and p.stock >= :quantity")
	int reserveStock(@Param("id") String id, @Param("quantity") int quantity,
			@Param("now") java.time.Instant now);

	@Modifying(flushAutomatically = true)
	@Query("update ShopProduct p set p.stock = p.stock + :quantity, p.updatedAt = :now "
			+ "where p.id = :id and :quantity > 0")
	int restoreStock(@Param("id") String id, @Param("quantity") int quantity,
			@Param("now") java.time.Instant now);
}
