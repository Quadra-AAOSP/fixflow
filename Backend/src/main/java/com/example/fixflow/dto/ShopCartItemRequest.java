package com.example.fixflow.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record ShopCartItemRequest(
		@NotBlank String productId,
		@NotNull @Min(1) Integer quantity
) {
}
