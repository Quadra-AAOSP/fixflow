package com.example.fixflow.config;

import com.example.fixflow.ai.AIProvider;
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
    public AIProvider openRouterProvider(ObjectMapper objectMapper) {
        return new OpenRouterProvider(objectMapper);
    }
}