package com.example.fixflow.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "fixflow.minio")
public record MinioConfig(
		String endpoint,
		String accessKey,
		String secretKey,
		String bucket
) {
}
