package com.example.fixflow.ai.openrouter;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Request DTO for OpenRouter API chat completions.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OpenRouterRequest {

    private String model;
    private List<Message> messages;
    private double temperature;

    @JsonProperty("max_tokens")
    private int maxTokens;

    /**
     * Message wrapper for OpenRouter chat API.
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Message {
        private String role;
        private String content;
    }
}