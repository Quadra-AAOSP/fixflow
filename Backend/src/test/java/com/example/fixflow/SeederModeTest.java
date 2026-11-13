package com.example.fixflow;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import com.example.fixflow.config.DemoDataLoader;

class SeederModeTest {

	private final ApplicationContextRunner context = new ApplicationContextRunner()
			.withUserConfiguration(DemoDataLoader.class)
			.withBean(javax.sql.DataSource.class, () -> {
				DriverManagerDataSource dataSource = new DriverManagerDataSource();
				dataSource.setDriverClassName("org.h2.Driver");
				dataSource.setUrl("jdbc:h2:mem:demo-loader-mode;MODE=MySQL;DB_CLOSE_DELAY=-1");
				dataSource.setUsername("sa");
				dataSource.setPassword("");
				return dataSource;
			});

	@Test
	void registersDemoLoaderOnlyWhenDemoSeedEnabled() {
		context.withPropertyValues("fixflow.seed.demo-enabled=false")
				.run(app -> assertThat(app).doesNotHaveBean(DemoDataLoader.class));
		context.withPropertyValues("fixflow.seed.demo-enabled=true")
				.run(app -> assertThat(app).hasSingleBean(DemoDataLoader.class));
	}
}
