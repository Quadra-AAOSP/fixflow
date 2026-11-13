package com.example.fixflow.bootstrap;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "fixflow.bootstrap")
public record BootstrapProperties(
		String superAdminEmail,
		String superAdminPassword
) {
}
