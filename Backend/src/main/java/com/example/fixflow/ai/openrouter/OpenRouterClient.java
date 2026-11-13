package com.example.fixflow.ai.openrouter;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeoutException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientRequestException;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import com.example.fixflow.ai.AIProviderException;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import reactor.util.retry.Retry;

/**
 * Shared OpenRouter chat-completions transport: auth, retries, and error mapping.
 */
public final class OpenRouterClient {

	private static final Logger log = LoggerFactory.getLogger(OpenRouterClient.class);

	private final WebClient webClient;
	private final ObjectMapper objectMapper;
	private final String apiKey;
	private final Duration timeout;
	private final long maxRetries;
	private final Duration retryBackoff;

	public OpenRouterClient(
			ObjectMapper objectMapper,
			String apiKey,
			String baseUrl,
			long timeoutSeconds,
			long maxRetries,
			long retryBackoffSeconds
	) {
		if (timeoutSeconds < 1 || timeoutSeconds > 120 || maxRetries < 0 || maxRetries > 3
				|| retryBackoffSeconds < 0 || retryBackoffSeconds > 30) {
			throw new IllegalArgumentException("Invalid OpenRouter timeout or retry limits");
		}
		this.objectMapper = objectMapper;
		this.apiKey = apiKey;
		this.timeout = Duration.ofSeconds(timeoutSeconds);
		this.maxRetries = maxRetries;
		this.retryBackoff = Duration.ofSeconds(retryBackoffSeconds);
		this.webClient = WebClient.builder()
				.baseUrl(baseUrl)
				.defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
				.defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
				.build();
	}

	public void requireApiKey() throws AIProviderException {
		if (apiKey == null || apiKey.isBlank()) {
			throw new AIProviderException(
					"OpenRouter API key is not configured",
					AIProviderException.AIErrorType.AUTHENTICATION_ERROR);
		}
	}

	public ObjectMapper mapper() {
		return objectMapper;
	}

	/** Posts a chat-completions payload and returns the raw response body. */
	public String post(Object payload) throws AIProviderException {
		requireApiKey();
		try {
			String body = objectMapper.writeValueAsString(payload);
			String responseBody = webClient.post()
					.bodyValue(body)
					.retrieve()
					.bodyToMono(String.class)
					.timeout(timeout)
					.retryWhen(Retry.backoff(maxRetries, retryBackoff)
							.filter(this::isRetryable)
							.onRetryExhaustedThrow((spec, signal) -> signal.failure()))
					.block();
			if (responseBody == null || responseBody.isBlank()) {
				throw new AIProviderException(
						"Invalid response from OpenRouter: empty or null response",
						AIProviderException.AIErrorType.INVALID_RESPONSE);
			}
			return responseBody;
		} catch (AIProviderException e) {
			throw e;
		} catch (WebClientResponseException e) {
			throw mapResponseException(e);
		} catch (WebClientRequestException e) {
			log.warn("OpenRouter network request failed");
			throw new AIProviderException(
					"Network error calling OpenRouter", e, AIProviderException.AIErrorType.NETWORK_ERROR);
		} catch (Exception e) {
			Throwable root = reactor.core.Exceptions.unwrap(e);
			if (root instanceof TimeoutException) {
				throw new AIProviderException(
						"OpenRouter request timed out", e, AIProviderException.AIErrorType.TIMEOUT);
			}
			if (e instanceof JsonProcessingException || root instanceof JsonProcessingException) {
				throw new AIProviderException(
						"Invalid response from OpenRouter", e, AIProviderException.AIErrorType.INVALID_RESPONSE);
			}
			log.warn("OpenRouter request failed ({})", e.getClass().getSimpleName());
			throw new AIProviderException(
					"Unexpected error calling OpenRouter", e, AIProviderException.AIErrorType.UNKNOWN_ERROR);
		}
	}

	/** Posts without retries (used by vision fallback loops that handle retries themselves). */
	public String postOnce(Object payload) throws Exception {
		requireApiKey();
		return webClient.post()
				.bodyValue(objectMapper.writeValueAsString(payload))
				.retrieve()
				.bodyToMono(String.class)
				.timeout(timeout)
				.block();
	}

	public Envelope parseEnvelope(String responseBody) throws AIProviderException {
		try {
			Envelope response = objectMapper.readValue(responseBody, Envelope.class);
			if (response == null || response.choices() == null || response.choices().isEmpty()) {
				throw new AIProviderException(
						"Invalid response from OpenRouter: empty or null response",
						AIProviderException.AIErrorType.INVALID_RESPONSE);
			}
			return response;
		} catch (AIProviderException e) {
			throw e;
		} catch (Exception e) {
			throw new AIProviderException(
					"Invalid response from OpenRouter", e, AIProviderException.AIErrorType.INVALID_RESPONSE);
		}
	}

	public String firstContent(Envelope response) throws AIProviderException {
		Choice choice = response.choices().get(0);
		if (choice == null || choice.message() == null
				|| choice.message().content() == null
				|| choice.message().content().isBlank()) {
			throw new AIProviderException(
					"Invalid response from OpenRouter: empty or null reply",
					AIProviderException.AIErrorType.INVALID_RESPONSE);
		}
		return choice.message().content().trim();
	}

	public JsonNode parseModelJson(String content) throws Exception {
		return objectMapper.reader()
				.with(DeserializationFeature.FAIL_ON_TRAILING_TOKENS)
				.readTree(ModelJson.unwrap(content));
	}

	private boolean isRetryable(Throwable throwable) {
		if (throwable instanceof WebClientResponseException e) {
			int status = e.getStatusCode().value();
			return status >= 500 || status == 429;
		}
		return throwable instanceof TimeoutException || throwable instanceof WebClientRequestException;
	}

	private AIProviderException mapResponseException(WebClientResponseException e) {
		int status = e.getStatusCode().value();
		if (status == 401 || status == 403) {
			log.warn("OpenRouter authentication rejected");
			return new AIProviderException(
					"Authentication error with OpenRouter", e, AIProviderException.AIErrorType.AUTHENTICATION_ERROR);
		}
		if (status == 429) {
			log.warn("OpenRouter rate limit exceeded");
			return new AIProviderException(
					"Rate limit exceeded with OpenRouter", e, AIProviderException.AIErrorType.RATE_LIMIT);
		}
		if (status >= 500) {
			log.warn("OpenRouter service failure ({})", status);
			return new AIProviderException(
					"OpenRouter API error", e, AIProviderException.AIErrorType.API_ERROR);
		}
		log.warn("OpenRouter request rejected ({})", status);
		return new AIProviderException(
				"OpenRouter request failed", e, AIProviderException.AIErrorType.API_ERROR);
	}

	@JsonIgnoreProperties(ignoreUnknown = true)
	public record Envelope(List<Choice> choices) {
	}

	@JsonIgnoreProperties(ignoreUnknown = true)
	public record Choice(Message message, @JsonProperty("finish_reason") String finishReason) {
	}

	@JsonIgnoreProperties(ignoreUnknown = true)
	public record Message(String role, String content) {
	}

	/** Chat-completions request body shared by text and chat providers. */
	@JsonInclude(JsonInclude.Include.NON_NULL)
	public record ChatRequest(
			String model,
			List<ChatMessage> messages,
			double temperature,
			@JsonProperty("max_tokens") int maxTokens,
			@JsonProperty("response_format") Map<String, String> responseFormat,
			Map<String, String> reasoning
	) {
		public record ChatMessage(String role, Object content) {
		}
	}
}
