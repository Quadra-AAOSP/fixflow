package com.example.fixflow.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import io.minio.MakeBucketArgs;
import io.minio.MinioClient;

/**
 * Optional raw MinioClient bean for callers that need the SDK directly.
 * Primary photo I/O goes through {@link com.example.fixflow.service.ObjectStorageService}.
 */
@Configuration
@EnableConfigurationProperties(MinioConfig.class)
@ConditionalOnProperty(prefix = "fixflow.minio", name = "enabled", havingValue = "true", matchIfMissing = true)
public class MinioClientConfig {

	private static final Logger log = LoggerFactory.getLogger(MinioClientConfig.class);

	@Bean
	MinioClient minioClient(MinioConfig config) {
		MinioClient client = MinioClient.builder()
				.endpoint(config.endpoint())
				.credentials(config.accessKey(), config.secretKey())
				.build();
		try {
			client.makeBucket(MakeBucketArgs.builder().bucket(config.bucket()).build());
		} catch (Exception e) {
			log.debug("MinIO bucket '{}' creation skipped (may already exist): {}",
					config.bucket(), e.getMessage());
		}
		return client;
	}
}
