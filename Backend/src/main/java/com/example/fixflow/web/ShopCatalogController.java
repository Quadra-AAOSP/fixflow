package com.example.fixflow.web;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.fixflow.dto.ShopCatalogResponse;
import com.example.fixflow.service.ShopCatalogService;

@RestController
@RequestMapping("/api/shop")
public class ShopCatalogController {

	private final ShopCatalogService shopCatalogService;

	public ShopCatalogController(ShopCatalogService shopCatalogService) {
		this.shopCatalogService = shopCatalogService;
	}

	@GetMapping("/catalog")
	public ShopCatalogResponse catalog() {
		return shopCatalogService.getCatalog();
	}
}
