package com.example.fixflow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import javax.sql.DataSource;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.example.fixflow.bootstrap.BootstrapProperties;
import com.example.fixflow.bootstrap.DataSeeder;
import com.example.fixflow.repository.ShopProductRepository;
import com.example.fixflow.repository.SiteRepository;
import com.example.fixflow.repository.SiteRuleRepository;
import com.example.fixflow.repository.SubsiteRepository;
import com.example.fixflow.repository.UserRepository;

class SeederModeTest {

	private final ApplicationContextRunner context = new ApplicationContextRunner()
			.withUserConfiguration(DataSeeder.class)
			.withBean(SiteRuleRepository.class, () -> mock(SiteRuleRepository.class))
			.withBean(ShopProductRepository.class, () -> mock(ShopProductRepository.class))
			.withBean(UserRepository.class, () -> mock(UserRepository.class))
			.withBean(SiteRepository.class, () -> mock(SiteRepository.class))
			.withBean(SubsiteRepository.class, () -> mock(SubsiteRepository.class))
			.withBean(PasswordEncoder.class, () -> mock(PasswordEncoder.class))
			.withBean(BootstrapProperties.class, () -> new BootstrapProperties("", ""))
			.withBean(DataSource.class, () -> mock(DataSource.class));

	@Test
	void alwaysRegistersSingleSeeder() {
		context.run(app -> assertThat(app).hasSingleBean(DataSeeder.class));
		context.withPropertyValues("fixflow.seed.demo-enabled=false")
				.run(app -> assertThat(app).hasSingleBean(DataSeeder.class));
		context.withPropertyValues("fixflow.seed.demo-enabled=true")
				.run(app -> assertThat(app).hasSingleBean(DataSeeder.class));
	}
}
