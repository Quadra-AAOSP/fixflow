package com.example.fixflow.ai.openrouter;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Response DTO for OpenRouter API chat completions.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OpenRouterResponse {

    private String id;
    private String object;
    private long created;
    private String model;
    private List<Choice> choices;
    private Usage usage;

    /**
     * Choice wrapper for OpenRouter response.
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Choice {
        private int index;
        private Message message;

        @JsonProperty("finish_reason")
        private String finishReason;

        /**
         * Message wrapper for choice content.
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

    /**
     * Usage statistics for the API call.
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Usage {
        @JsonProperty("prompt_tokens")
        private int promptTokens;

        @JsonProperty("completion_tokens")
        private int completionTokens;

        @JsonProperty("total_tokens")
        private int totalTokens;
    }
}