package com.example.fixflow.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import io.minio.MinioClient;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;

@Configuration
@EnableConfigurationProperties({ ShopProperties.class, MinioProperties.class })
public class AppConfig {

	@Bean
	@ConditionalOnProperty(prefix = "fixflow.minio", name = "enabled", havingValue = "true", matchIfMissing = true)
	MinioClient minioClient(MinioProperties config) {
		return MinioClient.builder()
				.endpoint(config.endpoint())
				.credentials(config.accessKey(), config.secretKey())
				.build();
	}

	@Bean
	OpenAPI fixflowOpenApi() {
		return new OpenAPI().info(new Info()
				.title("FixFlow API")
				.version("1.0")
				.description("Member 1 platform foundation, technician network, and report intake. "
						+ "Paths remain under /api (not /api/v1). OpenAPI is the contract source for clients."));
	}
}
