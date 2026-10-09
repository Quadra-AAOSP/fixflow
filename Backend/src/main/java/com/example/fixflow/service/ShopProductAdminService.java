package com.example.fixflow.service;

import java.net.URI;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.fixflow.domain.ShopProduct;
import com.example.fixflow.domain.UserRole;
import com.example.fixflow.dto.ShopProductAdminResponse;
import com.example.fixflow.dto.ShopProductRequest;
import com.example.fixflow.dto.ShopProductUpdateRequest;
import com.example.fixflow.repository.ShopProductRepository;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.web.ApiException;

@Service
public class ShopProductAdminService {

	private final ShopProductRepository shopProductRepository;

	public ShopProductAdminService(ShopProductRepository shopProductRepository) {
		this.shopProductRepository = shopProductRepository;
	}

	@Transactional(readOnly = true)
	public List<ShopProductAdminResponse> list(AppUserDetails principal) {
		requireAdmin(principal);
		return shopProductRepository.findAll().stream()
				.map(ShopProductAdminResponse::from)
				.toList();
	}

	@Transactional(readOnly = true)
	public ShopProductAdminResponse get(String id, AppUserDetails principal) {
		requireAdmin(principal);
		return ShopProductAdminResponse.from(requireProduct(id));
	}

	@Transactional
	public ShopProductAdminResponse create(ShopProductRequest request, AppUserDetails principal) {
		requireAdmin(principal);
		if (shopProductRepository.existsById(request.id().trim())) {
			throw new ApiException(409, "Product id already exists: " + request.id());
		}
		validateHttpsImage(request.imageUrl());
		ShopProduct product = new ShopProduct();
		product.setId(request.id().trim());
		apply(product, request.name(), request.description(), request.category(), request.brand(),
				request.imageUrl(), request.priceMinor(), request.stock(),
				request.active() == null || request.active());
		return ShopProductAdminResponse.from(shopProductRepository.save(product));
	}

	@Transactional
	public ShopProductAdminResponse update(String id, ShopProductUpdateRequest request, AppUserDetails principal) {
		requireAdmin(principal);
		ShopProduct product = requireProduct(id);
		validateHttpsImage(request.imageUrl());
		apply(product, request.name(), request.description(), request.category(), request.brand(),
				request.imageUrl(), request.priceMinor(), request.stock(), request.active());
		return ShopProductAdminResponse.from(shopProductRepository.save(product));
	}

	@Transactional
	public void delete(String id, AppUserDetails principal) {
		requireAdmin(principal);
		ShopProduct product = requireProduct(id);
		product.setActive(false);
		shopProductRepository.save(product);
	}

	private ShopProduct requireProduct(String id) {
		return shopProductRepository.findById(id)
				.orElseThrow(() -> new ApiException(404, "Product not found: " + id));
	}

	private static void apply(
			ShopProduct product,
			String name,
			String description,
			String category,
			String brand,
			String imageUrl,
			int priceMinor,
			int stock,
			boolean active
	) {
		product.setName(name.trim());
		product.setDescription(description);
		product.setCategory(category.trim());
		product.setBrand(brand == null || brand.isBlank() ? null : brand.trim());
		product.setImageUrl(imageUrl == null || imageUrl.isBlank() ? null : imageUrl.trim());
		product.setPriceMinor(priceMinor);
		product.setStock(stock);
		product.setActive(active);
	}

	private static void validateHttpsImage(String imageUrl) {
		if (imageUrl == null || imageUrl.isBlank()) {
			return;
		}
		try {
			URI uri = URI.create(imageUrl.trim());
			if (!"https".equalsIgnoreCase(uri.getScheme())) {
				throw new ApiException(400, "Product imageUrl must use HTTPS");
			}
		}
		catch (IllegalArgumentException ex) {
			throw new ApiException(400, "Product imageUrl is invalid");
		}
	}

	private static void requireAdmin(AppUserDetails principal) {
		if (principal == null) {
			throw new ApiException(401, "Authentication required");
		}
		UserRole role = principal.getRole();
		if (role != UserRole.admin && role != UserRole.super_admin) {
			throw new ApiException(403, "Admin access required");
		}
	}
}
