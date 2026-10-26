package com.example.fixflow.config;

import com.example.fixflow.ai.AIProvider;
import com.example.fixflow.ai.ChatProvider;
import com.example.fixflow.ai.OpenRouterChatProvider;
import com.example.fixflow.ai.OpenRouterProvider;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Configuration for AI providers.
 * Currently supports OpenRouter for text classification.
 */
@Configuration
public class AIProviderConfig {

    @Bean
    @ConditionalOnExpression("'${openrouter.api-key:}' != ''")
    public AIProvider openRouterProvider(
            ObjectMapper objectMapper,
            @org.springframework.beans.factory.annotation.Value("${openrouter.api-key:}") String apiKey,
            @org.springframework.beans.factory.annotation.Value("${openrouter.model}") String model,
            @org.springframework.beans.factory.annotation.Value("${openrouter.base-url}") String baseUrl,
            @org.springframework.beans.factory.annotation.Value("${openrouter.timeout-seconds}") long timeoutSeconds,
            @org.springframework.beans.factory.annotation.Value("${openrouter.max-retries}") long maxRetries,
            @org.springframework.beans.factory.annotation.Value("${openrouter.retry-backoff-seconds}") long retryBackoffSeconds,
            @org.springframework.beans.factory.annotation.Value("${openrouter.temperature}") double temperature,
            @org.springframework.beans.factory.annotation.Value("${openrouter.max-tokens}") int maxTokens) {
        return new OpenRouterProvider(
                objectMapper, apiKey, model, baseUrl, timeoutSeconds, maxRetries,
                retryBackoffSeconds, temperature, maxTokens);
    }

    @Bean
    @ConditionalOnExpression("'${openrouter.api-key:}' != ''")
    public ChatProvider openRouterChatProvider(
            ObjectMapper objectMapper,
            @org.springframework.beans.factory.annotation.Value("${openrouter.api-key:}") String apiKey,
            @org.springframework.beans.factory.annotation.Value("${openrouter.chat.model}") String chatModel,
            @org.springframework.beans.factory.annotation.Value("${openrouter.base-url}") String baseUrl,
            @org.springframework.beans.factory.annotation.Value("${openrouter.timeout-seconds}") long timeoutSeconds,
            @org.springframework.beans.factory.annotation.Value("${openrouter.max-retries}") long maxRetries,
            @org.springframework.beans.factory.annotation.Value("${openrouter.retry-backoff-seconds}") long retryBackoffSeconds,
            @org.springframework.beans.factory.annotation.Value("${openrouter.chat.temperature}") double chatTemperature,
            @org.springframework.beans.factory.annotation.Value("${openrouter.chat.max-tokens}") int chatMaxTokens) {
        return new OpenRouterChatProvider(
                objectMapper, apiKey, chatModel, baseUrl, timeoutSeconds, maxRetries,
                retryBackoffSeconds, chatTemperature, chatMaxTokens);
    }

    /**
     * Spring Boot 4 configures Jackson 3 by default. OpenRouter DTOs use
     * Jackson 2 annotations, so provide a dedicated compatible mapper.
     */
    @Bean
    public ObjectMapper openRouterObjectMapper() {
        return new ObjectMapper();
    }
}
