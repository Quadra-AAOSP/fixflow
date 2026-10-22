package com.example.fixflow.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;

@Configuration
public class OpenApiConfig {

	@Bean
	OpenAPI fixflowOpenApi() {
		return new OpenAPI().info(new Info()
				.title("FixFlow API")
				.version("1.0")
				.description("Member 1 platform foundation, technician network, and report intake. "
						+ "Paths remain under /api (not /api/v1). OpenAPI is the contract source for clients."));
	}
}
