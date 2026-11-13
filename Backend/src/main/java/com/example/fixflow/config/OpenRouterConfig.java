package com.example.fixflow.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;

import com.example.fixflow.ai.OpenRouterAi;
import com.example.fixflow.service.ReportVisionService;
import com.fasterxml.jackson.databind.ObjectMapper;

/** Wires the single OpenRouter AI client and optional vision poll worker. */
@Configuration
public class OpenRouterConfig {

	/**
	 * Spring Boot 4 configures Jackson 3 by default. OpenRouter DTOs use
	 * Jackson 2 annotations, so provide a dedicated compatible mapper.
	 */
	@Bean
	ObjectMapper openRouterObjectMapper() {
		return new ObjectMapper();
	}

	@Bean
	@ConditionalOnExpression("'${openrouter.api-key:}' != ''")
	OpenRouterAi openRouterAi(
			ObjectMapper objectMapper,
			@Value("${openrouter.api-key}") String apiKey,
			@Value("${openrouter.base-url}") String baseUrl,
			@Value("${openrouter.timeout-seconds}") long timeoutSeconds,
			@Value("${openrouter.max-retries}") long maxRetries,
			@Value("${openrouter.retry-backoff-seconds}") long retryBackoffSeconds,
			@Value("${openrouter.model}") String textModel,
			@Value("${openrouter.temperature}") double textTemperature,
			@Value("${openrouter.max-tokens}") int textMaxTokens,
			@Value("${openrouter.chat.model}") String chatModel,
			@Value("${openrouter.chat.timeout-seconds}") long chatTimeoutSeconds,
			@Value("${openrouter.chat.temperature}") double chatTemperature,
			@Value("${openrouter.chat.max-tokens}") int chatMaxTokens,
			@Value("${openrouter.vision.enabled:false}") boolean visionEnabled,
			@Value("${openrouter.vision.model:}") String visionPrimary,
			@Value("${openrouter.vision.fallback-model:}") String visionFallback,
			@Value("${openrouter.max-tokens}") int visionMaxTokens,
			@Value("${openrouter.ranking.enabled:false}") boolean rankingEnabled,
			@Value("${openrouter.ranking.model:${openrouter.model}}") String rankingModel,
			@Value("${openrouter.ranking.timeout-seconds:15}") int rankingTimeoutSeconds
	) {
		if (visionEnabled && (visionPrimary == null || visionPrimary.isBlank())) {
			throw new IllegalStateException("openrouter.vision.model is required when vision is enabled");
		}
		return new OpenRouterAi(
				objectMapper,
				apiKey,
				baseUrl,
				timeoutSeconds,
				maxRetries,
				retryBackoffSeconds,
				textModel,
				textTemperature,
				textMaxTokens,
				chatModel,
				chatTimeoutSeconds,
				chatTemperature,
				chatMaxTokens,
				visionEnabled,
				visionPrimary,
				visionFallback,
				visionMaxTokens,
				rankingEnabled,
				rankingModel,
				rankingTimeoutSeconds);
	}

	@Bean
	@ConditionalOnProperty(prefix = "openrouter.vision", name = "enabled", havingValue = "true")
	ThreadPoolTaskScheduler visionScheduler() {
		ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
		scheduler.setPoolSize(1);
		scheduler.setThreadNamePrefix("vision-");
		return scheduler;
	}

	@Configuration
	@EnableScheduling
	@ConditionalOnProperty(prefix = "openrouter.vision", name = "enabled", havingValue = "true")
	static class VisionWorker {

		private final ReportVisionService service;

		VisionWorker(ReportVisionService service) {
			this.service = service;
		}

		@Scheduled(scheduler = "visionScheduler", fixedDelayString = "${openrouter.vision.poll-ms:2000}")
		void process() {
			service.processPending();
		}
	}
}
