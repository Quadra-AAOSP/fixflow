package com.example.fixflow.security;

import static org.assertj.core.api.Assertions.assertThat;
import java.sql.DriverManager;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mysql.MySQLContainer;

/** Uses a disposable database only; never reads the deployment DB credentials. */
@Testcontainers(disabledWithoutDocker = true)
class MySqlSchemaMigrationTest {
    @Container
    static final MySQLContainer MYSQL = new MySQLContainer("mysql:8.0.37")
            .withDatabaseName("fixflow_migration").withUsername("migration_test").withPassword("test-only-password");

    @Test void freshSchemaAndLegacyUpgradeAreRestartSafeAndPreserveReports() throws Exception {
        try (var connection = DriverManager.getConnection(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword())) {
            var resource = new ClassPathResource("db/schema.sql");
            ScriptUtils.executeSqlScript(connection, resource);
            ScriptUtils.executeSqlScript(connection, resource);
            try (var statement = connection.createStatement()) {
                statement.executeUpdate("INSERT INTO sites (name,type) VALUES ('Legacy campus','school')");
                statement.executeUpdate("INSERT INTO users (email,password_hash,first_name,last_name,role,site_id) VALUES ('legacy@example.test','unused','Legacy','Reporter','reporter',1)");
                statement.executeUpdate("INSERT INTO reports (site_id,created_by_user_id,description,category,reporter_urgency) VALUES (1,1,'Preserve this report','plumbing','high')");
                statement.execute("ALTER TABLE reports DROP FOREIGN KEY fk_reports_subsite");
                statement.execute("ALTER TABLE reports DROP COLUMN subsite_id");
                statement.execute("ALTER TABLE subsites DROP COLUMN archived_at");
            }
            ScriptUtils.executeSqlScript(connection, resource);
            ScriptUtils.executeSqlScript(connection, resource);
            try (var statement = connection.createStatement(); var rows = statement.executeQuery(
                    "SELECT description,subsite_id,reporter_urgency FROM reports WHERE id=1")) {
                assertThat(rows.next()).isTrue(); assertThat(rows.getString("description")).isEqualTo("Preserve this report");
                assertThat(rows.getObject("subsite_id")).isNull(); assertThat(rows.getString("reporter_urgency")).isEqualTo("high");
            }
            try (var statement = connection.createStatement()) {
                statement.executeUpdate("INSERT INTO subsites (site_id,label,name) VALUES (1,'E5','Classrooms')");
                statement.executeUpdate("UPDATE reports SET subsite_id=1 WHERE id=1");
                statement.executeUpdate("UPDATE subsites SET archived_at=CURRENT_TIMESTAMP WHERE id=1");
                statement.executeUpdate("INSERT INTO technician_terms_acceptances (technician_id,terms_version,document_url) VALUES (1,'test-v1','https://example.test/terms')");
            }
            ScriptUtils.executeSqlScript(connection, resource);
            try (var statement = connection.createStatement(); var rows = statement.executeQuery(
                    "SELECT r.subsite_id,s.archived_at FROM reports r JOIN subsites s ON s.id=r.subsite_id WHERE r.id=1")) {
                assertThat(rows.next()).isTrue(); assertThat(rows.getLong("subsite_id")).isEqualTo(1);
                assertThat(rows.getTimestamp("archived_at")).isNotNull();
            }
        }
    }
}
