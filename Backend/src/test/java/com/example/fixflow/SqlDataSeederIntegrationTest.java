package com.example.fixflow;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import com.example.fixflow.config.SqlDataSeeder;
import com.example.fixflow.repository.UserRepository;
import com.example.fixflow.domain.UserRole;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:sql-seed;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.sql.init.mode=always",
        "spring.sql.init.schema-locations=classpath:db/seed-test-extras.sql",
        "spring.jpa.defer-datasource-initialization=true",
        "fixflow.seed.demo-enabled=true"
})
class SqlDataSeederIntegrationTest {
    @Autowired SqlDataSeeder seeder;
    @Autowired JdbcTemplate jdbc;
    @Autowired UserRepository users;
    @Autowired PasswordEncoder passwords;

    @Test
    void standaloneDumpContainsTheCurrentSqlSources() throws Exception {
        String dump = java.nio.file.Files.readString(java.nio.file.Path.of("dev/fixflow-demo.sql"))
                .replace("\r\n", "\n");
        for (String file : new String[] { "schema.sql", "reference-data.sql", "demo-data.sql" }) {
            String source = java.nio.file.Files.readString(java.nio.file.Path.of("src/main/resources/db", file))
                    .replace("\r\n", "\n").trim();
            assertThat(dump).contains(source);
        }
    }

    @Test
    void sqlSeedsAreRepeatableAndEveryDemoPasswordMatchesEmail() {
        var accounts = users.findAll().stream().filter(u -> u.getEmail().endsWith("@fixflow.test")).toList();
        assertThat(accounts).hasSize(12);
        for (var user : accounts) {
            assertThat(passwords.matches(user.getEmail(), user.getPasswordHash())).isTrue();
        }
        assertThat(users.findByEmailIgnoreCase("shopmanager@fixflow.test").orElseThrow().getRole())
                .isEqualTo(UserRole.shop_manager);
        long reportCount = jdbc.queryForObject("select count(*) from reports", Long.class);
        long ruleCount = jdbc.queryForObject("select count(*) from site_rules", Long.class);
        jdbc.update("update users set password_hash=? where email=?",
                passwords.encode("ExistingPasswordIsPreserved"), "reporter@fixflow.test");
        jdbc.update("update shop_products set stock=3 where id='safety-gloves'");
        seeder.run(new DefaultApplicationArguments(new String[0]));
        assertThat(jdbc.queryForObject("select count(*) from reports", Long.class)).isEqualTo(reportCount);
        assertThat(jdbc.queryForObject("select count(*) from site_rules", Long.class)).isEqualTo(ruleCount);
        assertThat(jdbc.queryForObject("select stock from shop_products where id='safety-gloves'", Integer.class))
                .isEqualTo(3);
        assertThat(passwords.matches("ExistingPasswordIsPreserved",
                users.findByEmailIgnoreCase("reporter@fixflow.test").orElseThrow().getPasswordHash())).isTrue();
    }
}
