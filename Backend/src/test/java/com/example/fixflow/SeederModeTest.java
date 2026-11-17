package com.example.fixflow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.example.fixflow.config.DefaultAccountsLoader;
import com.example.fixflow.config.DemoDataLoader;
import com.example.fixflow.repository.UserRepository;

class SeederModeTest {

	private final ApplicationContextRunner demoContext = new ApplicationContextRunner()
			.withUserConfiguration(DemoDataLoader.class)
			.withBean(javax.sql.DataSource.class, () -> {
				DriverManagerDataSource dataSource = new DriverManagerDataSource();
				dataSource.setDriverClassName("org.h2.Driver");
				dataSource.setUrl("jdbc:h2:mem:demo-loader-mode;MODE=MySQL;DB_CLOSE_DELAY=-1");
				dataSource.setUsername("sa");
				dataSource.setPassword("");
				return dataSource;
			});

	private final ApplicationContextRunner defaultAccountsContext = new ApplicationContextRunner()
			.withUserConfiguration(DefaultAccountsLoader.class)
			.withBean(com.example.fixflow.repository.SiteRepository.class,
					() -> mock(com.example.fixflow.repository.SiteRepository.class))
			.withBean(UserRepository.class, () -> mock(UserRepository.class))
			.withBean(PasswordEncoder.class, BCryptPasswordEncoder::new);

	@Test
	void registersDemoLoaderOnlyWhenDemoSeedEnabled() {
		demoContext.withPropertyValues("fixflow.seed.demo-enabled=false")
				.run(app -> assertThat(app).doesNotHaveBean(DemoDataLoader.class));
		demoContext.withPropertyValues("fixflow.seed.demo-enabled=true")
				.run(app -> assertThat(app).hasSingleBean(DemoDataLoader.class));
	}

	@Test
	void registersDefaultAccountsLoaderOnlyWhenDemoSeedDisabled() {
		defaultAccountsContext.withPropertyValues("fixflow.seed.demo-enabled=false")
				.run(app -> assertThat(app).hasSingleBean(DefaultAccountsLoader.class));
		defaultAccountsContext.withPropertyValues("fixflow.seed.demo-enabled=true")
				.run(app -> assertThat(app).doesNotHaveBean(DefaultAccountsLoader.class));
		defaultAccountsContext.run(app -> assertThat(app).hasSingleBean(DefaultAccountsLoader.class));
	}
}
