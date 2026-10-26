package com.example.fixflow.ai;

import com.example.fixflow.ai.openrouter.OpenRouterRequest;
import com.example.fixflow.ai.openrouter.OpenRouterResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientRequestException;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.util.retry.Retry;

import java.time.Duration;
import java.util.List;

/**
 * OpenRouter implementation of {@link ChatProvider} for conversational AI.
 * Uses the chat-completions endpoint with the configured chat model and
 * mirrors the retry/timeout policy of {@link OpenRouterProvider}.
 */
public class OpenRouterChatProvider implements ChatProvider {

    private static final Logger logger = LoggerFactory.getLogger(OpenRouterChatProvider.class);
    private final WebClient webClient;
    private final String apiKey;
    private final String model;
    private final ObjectMapper objectMapper;
    private final Duration timeout;
    private final long maxRetries;
    private final Duration retryBackoff;
    private final double temperature;
    private final int maxTokens;

    public OpenRouterChatProvider(
            ObjectMapper objectMapper,
            @Value("${openrouter.api-key:}") String apiKey,
            @Value("${openrouter.chat.model}") String model,
            @Value("${openrouter.base-url}") String baseUrl,
            @Value("${openrouter.timeout-seconds}") long timeoutSeconds,
            @Value("${openrouter.max-retries}") long maxRetries,
            @Value("${openrouter.retry-backoff-seconds}") long retryBackoffSeconds,
            @Value("${openrouter.chat.temperature}") double temperature,
            @Value("${openrouter.chat.max-tokens}") int maxTokens) {
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
    public String chat(List<ChatMessage> messages) throws AIProviderException {
        if (apiKey == null || apiKey.trim().isEmpty()) {
            throw new AIProviderException("OpenRouter API key is not configured",
                    AIProviderException.AIErrorType.AUTHENTICATION_ERROR);
        }

        try {
            List<OpenRouterRequest.Message> outbound = messages.stream()
                    .map(message -> OpenRouterRequest.Message.builder()
                            .role(message.role())
                            .content(message.content())
                            .build())
                    .toList();
            OpenRouterRequest request = OpenRouterRequest.builder()
                    .model(model)
                    .messages(outbound)
                    .temperature(temperature)
                    .maxTokens(maxTokens)
                    .build();

            String responseBody = webClient.post()
                    .bodyValue(objectMapper.writeValueAsString(request))
                    .retrieve()
                    .bodyToMono(String.class)
                    .timeout(timeout)
                    .retryWhen(Retry.backoff(maxRetries, retryBackoff)
                            .filter(throwable -> isRetryable(throwable)))
                    .block();

            OpenRouterResponse response = responseBody == null
                    ? null
                    : objectMapper.readValue(responseBody, OpenRouterResponse.class);

            if (response == null || response.getChoices() == null || response.getChoices().isEmpty()
                    || response.getChoices().get(0).getMessage() == null
                    || response.getChoices().get(0).getMessage().getContent() == null
                    || response.getChoices().get(0).getMessage().getContent().isBlank()) {
                throw new AIProviderException("Invalid response from OpenRouter: empty or null reply",
                        AIProviderException.AIErrorType.INVALID_RESPONSE);
            }

            return response.getChoices().get(0).getMessage().getContent().trim();

        } catch (WebClientResponseException e) {
            throw handleWebClientException(e);
        } catch (WebClientRequestException e) {
            logger.error("Network error calling OpenRouter chat: {}", e.getMessage());
            throw new AIProviderException("Network error calling OpenRouter", e,
                    AIProviderException.AIErrorType.NETWORK_ERROR);
        } catch (AIProviderException e) {
            throw e;
        } catch (Exception e) {
            logger.error("Unexpected error calling OpenRouter chat: {}", e.getMessage());
            throw new AIProviderException("Unexpected error calling OpenRouter", e,
                    AIProviderException.AIErrorType.UNKNOWN_ERROR);
        }
    }

    @Override
    public String getProviderName() {
        return "OpenRouter";
    }

    private boolean isRetryable(Throwable throwable) {
        if (throwable instanceof WebClientResponseException e) {
            int statusCode = e.getStatusCode().value();
            return statusCode >= 500 || statusCode == 429;
        }
        return throwable instanceof WebClientRequestException;
    }

    private AIProviderException handleWebClientException(WebClientResponseException e) {
        int statusCode = e.getStatusCode().value();

        if (statusCode == 401 || statusCode == 403) {
            logger.error("Authentication error with OpenRouter chat: {}", e.getMessage());
            return new AIProviderException("Authentication error with OpenRouter", e,
                    AIProviderException.AIErrorType.AUTHENTICATION_ERROR);
        } else if (statusCode == 429) {
            logger.error("Rate limit exceeded with OpenRouter chat: {}", e.getMessage());
            return new AIProviderException("Rate limit exceeded with OpenRouter", e,
                    AIProviderException.AIErrorType.RATE_LIMIT);
        } else if (statusCode >= 500) {
            logger.error("OpenRouter chat server error: {}", e.getMessage());
            return new AIProviderException("OpenRouter server error", e,
                    AIProviderException.AIErrorType.API_ERROR);
        }
        logger.error("OpenRouter chat returned status {}: {}", statusCode, e.getMessage());
        return new AIProviderException("OpenRouter request failed with status " + statusCode, e,
                AIProviderException.AIErrorType.API_ERROR);
    }
}
