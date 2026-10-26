package com.example.fixflow.security;

import static org.assertj.core.api.Assertions.assertThat;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.core.io.FileSystemResource;

class ProductionConfigurationTest {
    @Test void productionYamlLoadsWithoutDuplicateKeysAndRetainsUploadAndSecurityDefaults() throws Exception {
        var sources = new YamlPropertySourceLoader().load("production",
                new FileSystemResource(Path.of("src/main/resources/application.yaml")));
        var config = sources.getFirst();
        assertThat(config.getProperty("spring.servlet.multipart.max-file-size")).isEqualTo("5MB");
        assertThat(config.getProperty("spring.servlet.multipart.max-request-size")).isEqualTo("30MB");
        assertThat(config.getProperty("server.servlet.session.cookie.http-only")).isEqualTo(true);
        assertThat(config.getProperty("server.servlet.session.cookie.same-site")).isEqualTo("lax");
        assertThat(config.getProperty("fixflow.rate-limit.enabled")).isEqualTo("${RATE_LIMIT_ENABLED:true}");
    }
}
