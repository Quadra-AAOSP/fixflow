package com.example.fixflow.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "fixflow.minio")
public record MinioProperties(
		boolean enabled,
		String endpoint,
		String accessKey,
		String secretKey,
		String bucket,
		String publicEndpoint
) {
	public MinioProperties(boolean enabled, String endpoint, String accessKey, String secretKey, String bucket) {
		this(enabled, endpoint, accessKey, secretKey, bucket, endpoint);
	}
	@org.springframework.boot.context.properties.bind.ConstructorBinding
	public MinioProperties {
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
		if (publicEndpoint == null || publicEndpoint.isBlank()) {
			publicEndpoint = endpoint;
		}
	}
}
