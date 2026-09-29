package com.example.fixflow.web;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.fixflow.dto.ShopCreateOrderRequest;
import com.example.fixflow.dto.ShopCreateOrderResponse;
import com.example.fixflow.dto.ShopOrderResponse;
import com.example.fixflow.dto.ShopQuoteRequest;
import com.example.fixflow.dto.ShopQuoteResponse;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.service.ShopOrderService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/shop")
public class ShopOrderController {

	private final ShopOrderService shopOrderService;

	public ShopOrderController(ShopOrderService shopOrderService) {
		this.shopOrderService = shopOrderService;
	}

	@PostMapping("/checkout/quote")
	public ShopQuoteResponse quote(
			@Valid @RequestBody ShopQuoteRequest request,
			@AuthenticationPrincipal AppUserDetails principal
	) {
		return shopOrderService.quote(request, principal);
	}

	@PostMapping("/orders")
	public ResponseEntity<ShopCreateOrderResponse> create(
			@Valid @RequestBody ShopCreateOrderRequest request,
			@RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
			@AuthenticationPrincipal AppUserDetails principal
	) {
		return ResponseEntity.status(HttpStatus.CREATED)
				.body(shopOrderService.create(request, idempotencyKey, principal));
	}

	@GetMapping("/orders")
	public List<ShopOrderResponse> list(@AuthenticationPrincipal AppUserDetails principal) {
		return shopOrderService.listMine(principal);
	}

	@GetMapping("/orders/{publicId}")
	public ShopOrderResponse get(
			@PathVariable String publicId,
			@AuthenticationPrincipal AppUserDetails principal
	) {
		return shopOrderService.getMine(publicId, principal);
	}

	@PostMapping("/orders/{publicId}/cancel")
	public ShopOrderResponse cancel(
			@PathVariable String publicId,
			@AuthenticationPrincipal AppUserDetails principal
	) {
		return shopOrderService.cancel(publicId, principal);
	}
}
