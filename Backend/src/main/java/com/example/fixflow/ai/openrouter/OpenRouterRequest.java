package com.example.fixflow.ai.openrouter;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

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

    @JsonInclude(JsonInclude.Include.NON_NULL)
    @JsonProperty("response_format")
    private Map<String, String> responseFormat;

    @JsonInclude(JsonInclude.Include.NON_NULL)
    private Map<String, String> reasoning;

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
