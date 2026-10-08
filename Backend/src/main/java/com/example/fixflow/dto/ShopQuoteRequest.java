package com.example.fixflow.dto;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;

public record ShopQuoteRequest(
		@NotEmpty @Valid List<ShopCartItemRequest> items
) {
}
