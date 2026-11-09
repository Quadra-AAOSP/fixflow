package com.example.fixflow.web;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.domain.UserRole;
import com.example.fixflow.web.ApiException;
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
	public ShopCatalogResponse catalog(@AuthenticationPrincipal AppUserDetails principal) {
        if (principal != null && principal.getRole() == UserRole.reporter) throw new ApiException(403, "Shop access unavailable");
		return shopCatalogService.getCatalog();
	}
}
