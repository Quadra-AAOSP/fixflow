package com.example.fixflow.web;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.dto.ShopOrderResponse;
import com.example.fixflow.service.ShopFulfillmentService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

@RestController
public class ShopFulfillmentController {
	private final ShopFulfillmentService service;
	public ShopFulfillmentController(ShopFulfillmentService service) { this.service = service; }
	public record Transition(@NotBlank String status) { }
	public record Receipt(@NotBlank @Size(max = 160) String signedName, @NotNull @AssertTrue Boolean received) { }
	@GetMapping("/api/admin/shop/orders")
	public ShopFulfillmentService.Inbox<ShopFulfillmentService.AdminOrder> list(@RequestParam(defaultValue = "0") int page, @AuthenticationPrincipal AppUserDetails principal) { return service.list(page, principal); }
	@GetMapping("/api/admin/shop/orders/{id}")
	public ShopFulfillmentService.AdminOrder get(@PathVariable String id, @AuthenticationPrincipal AppUserDetails principal) { return service.get(id, principal); }
	@PostMapping("/api/admin/shop/orders/{id}/fulfillment")
	public ShopFulfillmentService.AdminOrder advance(@PathVariable String id, @Valid @RequestBody Transition request, @AuthenticationPrincipal AppUserDetails principal) { return service.advance(id, request.status(), principal); }
	@PostMapping("/api/shop/orders/{id}/confirm-delivery")
	public ShopOrderResponse confirm(@PathVariable String id, @Valid @RequestBody Receipt request, @AuthenticationPrincipal AppUserDetails principal) { return service.confirm(id, request.signedName(), request.received(), principal); }
	@GetMapping("/api/shop/notifications")
	public ShopFulfillmentService.Inbox<ShopFulfillmentService.Notice> notices(@RequestParam(defaultValue = "0") int page, @AuthenticationPrincipal AppUserDetails principal) { return service.notifications(page, principal); }
}
