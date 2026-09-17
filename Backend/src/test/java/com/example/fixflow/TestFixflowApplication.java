package com.example.fixflow;

import org.springframework.boot.SpringApplication;

/**
 * Local entrypoint that previously wired Testcontainers.
 * Prefer {@code ./mvnw spring-boot:run} with Compose when Docker is available.
 */
public class TestFixflowApplication {

	public static void main(String[] args) {
		SpringApplication.from(FixflowApplication::main).run(args);
	}

}
