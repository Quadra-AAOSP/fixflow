package com.example.fixflow.config;

import javax.sql.DataSource;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Optional local SQL seed path, mutually exclusive with the normal seeders. */
@Component
@org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(
        prefix = "fixflow.seed", name = "demo-enabled", havingValue = "true")
@Order(1)
public class SqlDataSeeder implements ApplicationRunner {
    private final DataSource dataSource;

    public SqlDataSeeder(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        ResourceDatabasePopulator loader = new ResourceDatabasePopulator();
        loader.setSqlScriptEncoding("UTF-8");
        loader.addScript(new ClassPathResource("db/reference-data.sql"));
        org.slf4j.LoggerFactory.getLogger(SqlDataSeeder.class)
                .warn("Loading DEVELOPMENT demo SQL with publicly known passwords; never enable in production");
        loader.addScript(new ClassPathResource("db/demo-data.sql"));
        loader.execute(dataSource);
    }
}
