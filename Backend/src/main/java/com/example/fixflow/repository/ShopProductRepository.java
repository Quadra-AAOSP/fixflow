package com.example.fixflow.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.example.fixflow.domain.ShopProduct;

public interface ShopProductRepository extends JpaRepository<ShopProduct, String> {

	List<ShopProduct> findByActiveTrueOrderByNameAsc();

	/**
	 * Active products whose name, description, or category contains the given
	 * keyword (case-insensitive). Used by the report assistant to surface
	 * relevant FixFlow shop items when a repair needs materials or tools.
	 */
	@Query("select p from ShopProduct p where p.active = true and "
			+ "(lower(p.name) like lower(concat('%', :keyword, '%')) "
			+ "or lower(p.description) like lower(concat('%', :keyword, '%')) "
			+ "or lower(p.category) like lower(concat('%', :keyword, '%'))) "
			+ "order by p.name asc")
	List<ShopProduct> searchActiveByKeyword(@Param("keyword") String keyword);

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
	long countByActiveTrue();
	long countByActiveTrueAndStockGreaterThan(int stock);
	long countByActiveTrueAndStockLessThanEqual(int stock);

}
