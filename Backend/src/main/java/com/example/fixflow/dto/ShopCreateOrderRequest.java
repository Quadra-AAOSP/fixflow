package com.example.fixflow.dto;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

public record ShopCreateOrderRequest(
		@NotEmpty @Valid List<ShopCartItemRequest> items,
		@NotBlank @Size(max = 255) String shippingName,
		@Size(max = 64) String shippingPhone,
		@NotBlank @Size(max = 512) String shippingAddress
) {
}
