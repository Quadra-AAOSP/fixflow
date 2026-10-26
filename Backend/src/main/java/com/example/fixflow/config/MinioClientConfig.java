package com.example.fixflow.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import io.minio.MinioClient;

/**
 * Optional raw MinioClient bean for callers that need the SDK directly.
 * Primary photo I/O goes through {@link com.example.fixflow.service.ObjectStorageService}.
 */
@Configuration
@ConditionalOnProperty(prefix = "fixflow.minio", name = "enabled", havingValue = "true", matchIfMissing = true)
public class MinioClientConfig {

	@Bean
	MinioClient minioClient(MinioProperties config) {
		return MinioClient.builder()
				.endpoint(config.endpoint())
				.credentials(config.accessKey(), config.secretKey())
				.build();
	}
}
