package com.example.fixflow.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.fixflow.domain.ShopProduct;

public interface ShopProductRepository extends JpaRepository<ShopProduct, String> {

	List<ShopProduct> findByActiveTrueOrderByNameAsc();

	boolean existsById(String id);
}
