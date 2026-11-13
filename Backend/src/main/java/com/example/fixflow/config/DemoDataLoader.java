package com.example.fixflow.config;

import javax.sql.DataSource;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.stereotype.Component;

/**
 * Loads {@code db/demo-data.sql} when {@code fixflow.seed.demo-enabled=true}.
 * Taxonomy, shop catalog, and CNU sites come from {@code db/schema.sql}.
 */
@Component
@ConditionalOnProperty(prefix = "fixflow.seed", name = "demo-enabled", havingValue = "true")
public class DemoDataLoader implements ApplicationRunner {

	private static final Logger log = LoggerFactory.getLogger(DemoDataLoader.class);

	private final DataSource dataSource;

	public DemoDataLoader(DataSource dataSource) {
		this.dataSource = dataSource;
	}

	@Override
	public void run(ApplicationArguments args) {
		log.warn("Loading DEVELOPMENT demo SQL with publicly known passwords; never enable in production");
		ResourceDatabasePopulator loader = new ResourceDatabasePopulator();
		loader.setSqlScriptEncoding("UTF-8");
		loader.addScript(new ClassPathResource("db/demo-data.sql"));
		loader.execute(dataSource);
	}
}
