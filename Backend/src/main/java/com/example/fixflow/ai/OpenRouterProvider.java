package com.example.fixflow.ai;

import com.example.fixflow.ai.dto.ClassificationRequest;
import com.example.fixflow.ai.dto.ClassificationResponse;
import com.example.fixflow.ai.openrouter.OpenRouterRequest;
import com.example.fixflow.ai.openrouter.OpenRouterResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientRequestException;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;
import reactor.util.retry.Retry;

import java.time.Duration;
import java.util.List;

/**
 * OpenRouter implementation of AI provider for text classification.
 * Uses openrouter/free model for normal text AI requests.
 */
public class OpenRouterProvider implements AIProvider {

    private static final Logger logger = LoggerFactory.getLogger(OpenRouterProvider.class);
    private final WebClient webClient;
    private final String apiKey;
    private final String model;
    private final ObjectMapper objectMapper;
    private final Duration timeout;
    private final long maxRetries;
    private final Duration retryBackoff;
    private final double temperature;
    private final int maxTokens;

    public OpenRouterProvider(
            ObjectMapper objectMapper,
            @Value("${openrouter.api-key:}") String apiKey,
            @Value("${openrouter.model}") String model,
            @Value("${openrouter.base-url}") String baseUrl,
            @Value("${openrouter.timeout-seconds}") long timeoutSeconds,
            @Value("${openrouter.max-retries}") long maxRetries,
            @Value("${openrouter.retry-backoff-seconds}") long retryBackoffSeconds,
            @Value("${openrouter.temperature}") double temperature,
            @Value("${openrouter.max-tokens}") int maxTokens) {
        this.objectMapper = objectMapper;
        this.apiKey = apiKey;
        this.model = model;
        this.timeout = Duration.ofSeconds(timeoutSeconds);
        this.maxRetries = maxRetries;
        this.retryBackoff = Duration.ofSeconds(retryBackoffSeconds);
        this.temperature = temperature;
        this.maxTokens = maxTokens;

        this.webClient = WebClient.builder()
                .baseUrl(baseUrl)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                .build();
    }

    @Override
    public ClassificationResponse classifyText(ClassificationRequest request) throws AIProviderException {
        if (apiKey == null || apiKey.trim().isEmpty()) {
            throw new AIProviderException("OpenRouter API key is not configured", 
                    AIProviderException.AIErrorType.AUTHENTICATION_ERROR);
        }

        try {
            OpenRouterRequest openRouterRequest = buildOpenRouterRequest(request);
            
            OpenRouterResponse response = webClient.post()
                    .bodyValue(openRouterRequest)
                    .retrieve()
                    .bodyToMono(OpenRouterResponse.class)
                    .timeout(timeout)
                    .retryWhen(Retry.backoff(maxRetries, retryBackoff)
                            .filter(throwable -> isRetryable(throwable)))
                    .block();

            if (response == null || response.getChoices() == null || response.getChoices().isEmpty()) {
                throw new AIProviderException("Invalid response from OpenRouter: empty or null response",
                        AIProviderException.AIErrorType.INVALID_RESPONSE);
            }

            return parseClassificationResponse(response);
            
        } catch (WebClientResponseException e) {
            throw handleWebClientException(e);
        } catch (WebClientRequestException e) {
            logger.error("Network error calling OpenRouter: {}", e.getMessage());
            throw new AIProviderException("Network error calling OpenRouter", e, 
                    AIProviderException.AIErrorType.NETWORK_ERROR);
        } catch (Exception e) {
            logger.error("Unexpected error calling OpenRouter: {}", e.getMessage());
            throw new AIProviderException("Unexpected error calling OpenRouter", e, 
                    AIProviderException.AIErrorType.UNKNOWN_ERROR);
        }
    }

    private OpenRouterRequest buildOpenRouterRequest(ClassificationRequest request) {
        String systemPrompt = buildSystemPrompt(request);
        String userPrompt = buildUserPrompt(request);

        return OpenRouterRequest.builder()
                .model(model)
                .messages(List.of(
                        OpenRouterRequest.Message.builder()
                                .role("system")
                                .content(systemPrompt)
                                .build(),
                        OpenRouterRequest.Message.builder()
                                .role("user")
                                .content(userPrompt)
                                .build()
                ))
                .temperature(temperature)
                .maxTokens(maxTokens)
                .build();
    }

    private String buildSystemPrompt(ClassificationRequest request) {
        return String.format(
            "You are a maintenance report classification system for a %s site. " +
            "Classify the maintenance issue into a category, optional specialty, and urgency level. " +
            "You must ONLY use categories from this list: %s. " +
            "Response format: JSON with keys: category (required), specialty (optional, can be null), " +
            "urgency (one of: low, medium, high, critical). " +
            "If the category cannot be determined from the allowed list, set category to 'general'.",
            request.getSiteType(),
            String.join(", ", request.getAllowedCategories())
        );
    }

    private String buildUserPrompt(ClassificationRequest request) {
        StringBuilder prompt = new StringBuilder();
        prompt.append("Maintenance Report Description: ").append(request.getDescription()).append("\n");
        
        if (request.getAddress() != null && !request.getAddress().trim().isEmpty()) {
            prompt.append("Location: ").append(request.getAddress()).append("\n");
        }
        
        prompt.append("\nClassify this report according to the system instructions.");
        return prompt.toString();
    }

    private ClassificationResponse parseClassificationResponse(OpenRouterResponse response) throws AIProviderException {
        try {
            String content = response.getChoices().get(0).getMessage().getContent();
            JsonNode jsonNode = objectMapper.readTree(content);
            
            String category = jsonNode.has("category") ? jsonNode.get("category").asText() : "general";
            String specialty = jsonNode.has("specialty") && !jsonNode.get("specialty").isNull() 
                    ? jsonNode.get("specialty").asText() : null;
            String urgency = jsonNode.has("urgency") ? jsonNode.get("urgency").asText() : "medium";
            
            return ClassificationResponse.builder()
                    .category(category)
                    .specialty(specialty)
                    .urgency(urgency)
                    .provider("OpenRouter")
                    .model(model)
                    .build();
            
        } catch (Exception e) {
            logger.error("Failed to parse OpenRouter response: {}", e.getMessage());
            throw new AIProviderException("Failed to parse OpenRouter response", e, 
                    AIProviderException.AIErrorType.INVALID_RESPONSE);
        }
    }

    private AIProviderException handleWebClientException(WebClientResponseException e) {
        int statusCode = e.getStatusCode().value();
        
        if (statusCode == 401 || statusCode == 403) {
            logger.error("Authentication error with OpenRouter: {}", e.getMessage());
            return new AIProviderException("Authentication error with OpenRouter", e, 
                    AIProviderException.AIErrorType.AUTHENTICATION_ERROR);
        } else if (statusCode == 429) {
            logger.error("Rate limit exceeded with OpenRouter: {}", e.getMessage());
            return new AIProviderException("Rate limit exceeded with OpenRouter", e, 
                    AIProviderException.AIErrorType.RATE_LIMIT);
        } else if (statusCode >= 500) {
            logger.error("OpenRouter API error: {}", e.getMessage());
            return new AIProviderException("OpenRouter API error", e, 
                    AIProviderException.AIErrorType.API_ERROR);
        } else {
            logger.error("OpenRouter request failed with status {}: {}", statusCode, e.getMessage());
            return new AIProviderException("OpenRouter request failed", e, 
                    AIProviderException.AIErrorType.API_ERROR);
        }
    }

    private boolean isRetryable(Throwable throwable) {
        if (throwable instanceof WebClientResponseException) {
            int statusCode = ((WebClientResponseException) throwable).getStatusCode().value();
            return statusCode >= 500 || statusCode == 429;
        }
        return throwable instanceof java.util.concurrent.TimeoutException;
    }

    @Override
    public String getProviderName() {
        return "OpenRouter";
    }
}
