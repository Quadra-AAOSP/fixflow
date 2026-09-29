package com.example.fixflow.service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.fixflow.config.ShopProperties;
import com.example.fixflow.domain.ShopProduct;
import com.example.fixflow.dto.ShopCartItemRequest;
import com.example.fixflow.dto.ShopCatalogResponse;
import com.example.fixflow.dto.ShopProductResponse;
import com.example.fixflow.dto.ShopQuoteLineResponse;
import com.example.fixflow.dto.ShopQuoteResponse;
import com.example.fixflow.repository.ShopProductRepository;
import com.example.fixflow.web.ApiException;

@Service
public class ShopCatalogService {

	private final ShopProductRepository shopProductRepository;
	private final ShopProperties shopProperties;

	public ShopCatalogService(ShopProductRepository shopProductRepository, ShopProperties shopProperties) {
		this.shopProductRepository = shopProductRepository;
		this.shopProperties = shopProperties;
	}

	@Transactional(readOnly = true)
	public ShopCatalogResponse getCatalog() {
		List<ShopProductResponse> products = shopProductRepository.findByActiveTrueOrderByNameAsc().stream()
				.map(ShopProductResponse::from)
				.toList();
		return new ShopCatalogResponse(
				shopProperties.currency(),
				shopProperties.minorUnitDigits(),
				products
		);
	}

	@Transactional(readOnly = true)
	public PricedCart priceCart(List<ShopCartItemRequest> items) {
		if (items == null || items.isEmpty()) {
			throw new ApiException(400, "At least one item is required");
		}
		Map<String, Integer> quantities = new LinkedHashMap<>();
		for (ShopCartItemRequest item : items) {
			quantities.merge(item.productId(), item.quantity(), Integer::sum);
		}
		List<ShopQuoteLineResponse> lines = new ArrayList<>();
		int subtotal = 0;
		for (Map.Entry<String, Integer> entry : quantities.entrySet()) {
			ShopProduct product = shopProductRepository.findById(entry.getKey())
					.orElseThrow(() -> new ApiException(400, "Unknown product: " + entry.getKey()));
			if (!product.isActive()) {
				throw new ApiException(400, "Product is unavailable: " + product.getId());
			}
			int quantity = entry.getValue();
			if (quantity > product.getStock()) {
				throw new ApiException(409, "Insufficient stock for " + product.getName()
						+ " (available: " + product.getStock() + ")");
			}
			int lineTotal = product.getPriceMinor() * quantity;
			subtotal += lineTotal;
			lines.add(new ShopQuoteLineResponse(
					product.getId(),
					product.getName(),
					product.getPriceMinor(),
					quantity,
					lineTotal,
					product.getStock()
			));
		}
		int shipping = shopProperties.flatShippingMinor();
		int tax = 0;
		int total = subtotal + shipping + tax;
		ShopQuoteResponse quote = new ShopQuoteResponse(
				shopProperties.currency(),
				shopProperties.minorUnitDigits(),
				lines,
				subtotal,
				shipping,
				tax,
				total
		);
		return new PricedCart(quote, quantities);
	}

	public record PricedCart(ShopQuoteResponse quote, Map<String, Integer> quantities) {
	}
}
