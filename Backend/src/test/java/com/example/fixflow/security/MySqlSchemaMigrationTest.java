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
			.withDatabaseName("fixflow_migration")
			.withUsername("migration_test")
			.withPassword("test-only-password");

	@Test
	void schemaIsIdempotentAndPreservesExistingRows() throws Exception {
		try (var connection = DriverManager.getConnection(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword())) {
			var resource = new ClassPathResource("db/schema.sql");
			ScriptUtils.executeSqlScript(connection, resource);
			ScriptUtils.executeSqlScript(connection, resource);

			try (var statement = connection.createStatement()) {
				statement.executeUpdate(
						"INSERT INTO sites (name, type, contract_status, address) VALUES ('Legacy campus', 'school', 'contracted', 'Legacy')");
				statement.executeUpdate(
						"INSERT INTO users (email, password_hash, first_name, last_name, role, site_id) "
								+ "VALUES ('legacy@example.test', 'unused', 'Legacy', 'Reporter', 'reporter', "
								+ "(SELECT id FROM sites WHERE name = 'Legacy campus'))");
				statement.executeUpdate(
						"INSERT INTO reports (site_id, created_by_user_id, description, category, reporter_urgency) "
								+ "VALUES ((SELECT id FROM sites WHERE name = 'Legacy campus'), "
								+ "(SELECT id FROM users WHERE email = 'legacy@example.test'), "
								+ "'Preserve this report', 'plumbing', 'high')");
			}

			ScriptUtils.executeSqlScript(connection, resource);

			try (var statement = connection.createStatement();
					var rows = statement.executeQuery(
							"SELECT description, reporter_urgency FROM reports WHERE description = 'Preserve this report'")) {
				assertThat(rows.next()).isTrue();
				assertThat(rows.getString("description")).isEqualTo("Preserve this report");
				assertThat(rows.getString("reporter_urgency")).isEqualTo("high");
			}

			try (var statement = connection.createStatement();
					var sites = statement.executeQuery(
							"SELECT COUNT(*) FROM sites WHERE name IN ('CNU School', 'CNU Hostel', 'CNU Hotel')");
					var rules = statement.executeQuery("SELECT COUNT(*) FROM site_rules");
					var products = statement.executeQuery("SELECT COUNT(*) FROM shop_products")) {
				assertThat(sites.next()).isTrue();
				assertThat(sites.getInt(1)).isEqualTo(3);
				assertThat(rules.next()).isTrue();
				assertThat(rules.getInt(1)).isEqualTo(18);
				assertThat(products.next()).isTrue();
				assertThat(products.getInt(1)).isEqualTo(8);
			}

			try (var statement = connection.createStatement()) {
				statement.executeUpdate(
						"INSERT INTO subsites (site_id, label, name) VALUES "
								+ "((SELECT id FROM sites WHERE name = 'Legacy campus'), 'E5', 'Classrooms')");
				statement.executeUpdate(
						"UPDATE reports SET subsite_id = (SELECT id FROM subsites WHERE label = 'E5' LIMIT 1) "
								+ "WHERE description = 'Preserve this report'");
				statement.executeUpdate(
						"UPDATE subsites SET archived_at = CURRENT_TIMESTAMP(6) WHERE label = 'E5'");
			}

			ScriptUtils.executeSqlScript(connection, resource);

			try (var statement = connection.createStatement();
					var rows = statement.executeQuery(
							"SELECT r.subsite_id, s.archived_at FROM reports r "
									+ "JOIN subsites s ON s.id = r.subsite_id "
									+ "WHERE r.description = 'Preserve this report'")) {
				assertThat(rows.next()).isTrue();
				assertThat(rows.getObject("subsite_id")).isNotNull();
				assertThat(rows.getTimestamp("archived_at")).isNotNull();
			}
		}
	}
}
