package com.example.fixflow.security;

import static org.assertj.core.api.Assertions.assertThat;
import java.sql.DriverManager;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.FileSystemResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mysql.MySQLContainer;

/** Disposable database only: never reads deployment credentials. */
@Testcontainers(disabledWithoutDocker = true)
class MySqlDemoDumpTest {
    @Container
    static final MySQLContainer MYSQL = new MySQLContainer("mysql:8.0.37")
            .withDatabaseName("fixflow_demo").withUsername("demo_test").withPassword("test-only-password");

    @Test
    void fullDumpLoadsTwiceAndAllNewPasswordsMatchEmails() throws Exception {
        try (var connection = DriverManager.getConnection(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword())) {
            var dump = new FileSystemResource("dev/fixflow-demo.sql");
            ScriptUtils.executeSqlScript(connection, dump);
            ScriptUtils.executeSqlScript(connection, dump);
            var encoder = new BCryptPasswordEncoder();
            try (var statement = connection.createStatement(); var rows = statement.executeQuery(
                    "SELECT email,password_hash FROM users WHERE email LIKE '%@fixflow.test'")) {
                int accounts = 0;
                while (rows.next()) {
                    assertThat(encoder.matches(rows.getString(1), rows.getString(2))).isTrue();
                    accounts++;
                }
                assertThat(accounts).isEqualTo(12);
            }
        }
    }
}
