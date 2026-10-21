package com.example.fixflow.config;

import com.example.fixflow.ai.VisionProvider;
import org.springframework.context.annotation.Configuration;

/**
 * Configuration for AI vision providers.
 * Vision is opt-in and independent of manual text classification.
 */
@Configuration
public class VisionProviderConfig {

    @org.springframework.context.annotation.Bean
    @org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(
            prefix = "openrouter.vision", name = "enabled", havingValue = "true")
    public VisionProvider visionProvider(com.fasterxml.jackson.databind.ObjectMapper mapper,
            org.springframework.core.env.Environment env) {
        String key = env.getProperty("openrouter.api-key", "");
        if (key.isBlank()) throw new IllegalStateException("OPENROUTER_API_KEY is required when vision is enabled");
        return new com.example.fixflow.ai.OpenRouterVisionProvider(mapper, key,
                env.getRequiredProperty("openrouter.base-url"),
                env.getRequiredProperty("openrouter.vision.model"),
                env.getProperty("openrouter.vision.fallback-model", ""),
                env.getProperty("openrouter.timeout-seconds", Long.class, 30L),
                env.getProperty("openrouter.max-tokens", Integer.class, 1000));
    }

}
