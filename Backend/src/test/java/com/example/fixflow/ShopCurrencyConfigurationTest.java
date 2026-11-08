package com.example.fixflow;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import org.junit.jupiter.api.Test;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.core.io.FileSystemResource;

class ShopCurrencyConfigurationTest {
	@Test
	void defaultCurrencyIsYuanAndEnvironmentCanOverrideIt() throws IOException {
		var config = new YamlPropertySourceLoader().load("main", new FileSystemResource("src/main/resources/application.yaml"));
		var environment = new MockEnvironment();
		config.forEach(environment.getPropertySources()::addLast);
		assertThat(environment.resolvePlaceholders("${fixflow.shop.currency}")).isEqualTo("CNY");
		assertThat(environment.resolvePlaceholders("${fixflow.shop.minor-unit-digits}")).isEqualTo("2");
		environment.setProperty("SHOP_CURRENCY", "SGD");
		assertThat(environment.resolvePlaceholders("${fixflow.shop.currency}")).isEqualTo("SGD");
	}
}
