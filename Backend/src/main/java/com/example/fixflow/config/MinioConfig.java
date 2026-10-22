package com.example.fixflow.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "fixflow.minio")
public record MinioConfig(
		String endpoint,
		String accessKey,
		String secretKey,
		String bucket
) {
	public MinioConfig {
		if (endpoint == null || endpoint.isBlank()) {
			endpoint = "http://localhost:9000";
		}
		if (accessKey == null || accessKey.isBlank()) {
			accessKey = "minioadmin";
		}
		if (secretKey == null || secretKey.isBlank()) {
			secretKey = "minioadmin";
		}
		if (bucket == null || bucket.isBlank()) {
			bucket = "fixflow-photos";
		}
	}
}
