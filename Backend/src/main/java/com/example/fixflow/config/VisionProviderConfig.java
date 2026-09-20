package com.example.fixflow.config;

import com.example.fixflow.ai.VisionProvider;
import org.springframework.context.annotation.Configuration;

/**
 * Configuration for AI vision providers.
 * Currently placeholder for future vision model implementations.
 * Vision providers will be added here after testing and model selection.
 */
@Configuration
public class VisionProviderConfig {

    // Vision provider beans will be added here after model selection
    // Example:
    // @Bean
    // @ConditionalOnExpression("'${vision.provider.api-key:}' != ''")
    // public VisionProvider visionProvider(ObjectMapper objectMapper) {
    //     return new OpenRouterVisionProvider(objectMapper);
    // }
}