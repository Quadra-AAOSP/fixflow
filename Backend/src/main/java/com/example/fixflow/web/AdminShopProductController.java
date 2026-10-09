package com.example.fixflow.web;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.fixflow.dto.ShopProductAdminResponse;
import com.example.fixflow.dto.ShopProductRequest;
import com.example.fixflow.dto.ShopProductUpdateRequest;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.service.ShopProductAdminService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/admin/shop/products")
public class AdminShopProductController {

	private final ShopProductAdminService shopProductAdminService;

	public AdminShopProductController(ShopProductAdminService shopProductAdminService) {
		this.shopProductAdminService = shopProductAdminService;
	}

	@GetMapping
	public List<ShopProductAdminResponse> list(@AuthenticationPrincipal AppUserDetails principal) {
		return shopProductAdminService.list(principal);
	}

	@GetMapping("/{id}")
	public ShopProductAdminResponse get(
			@PathVariable String id,
			@AuthenticationPrincipal AppUserDetails principal
	) {
		return shopProductAdminService.get(id, principal);
	}

	@PostMapping
	public ResponseEntity<ShopProductAdminResponse> create(
			@Valid @RequestBody ShopProductRequest request,
			@AuthenticationPrincipal AppUserDetails principal
	) {
		return ResponseEntity.status(HttpStatus.CREATED)
				.body(shopProductAdminService.create(request, principal));
	}

	@PutMapping("/{id}")
	public ShopProductAdminResponse update(
			@PathVariable String id,
			@Valid @RequestBody ShopProductUpdateRequest request,
			@AuthenticationPrincipal AppUserDetails principal
	) {
		return shopProductAdminService.update(id, request, principal);
	}

	@DeleteMapping("/{id}")
	public ResponseEntity<Void> delete(
			@PathVariable String id,
			@AuthenticationPrincipal AppUserDetails principal
	) {
		shopProductAdminService.delete(id, principal);
		return ResponseEntity.noContent().build();
	}
}
