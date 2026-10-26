package com.example.fixflow.security;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;

@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:rate-limit;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE",
    "fixflow.rate-limit.authentication=2"})
class RateLimitIntegrationTest {
    @Autowired WebApplicationContext context;
    @Test void filterIsWiredAndSecurityHeadersArePresent() throws Exception {
        var mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        for (int attempt = 0; attempt < 3; attempt++) {
            var response = mvc.perform(post("/api/auth/login").with(csrf())
                    .contentType("application/json").content("{}"))
                    .andReturn().getResponse();
            assertThat(response.getStatus()).isEqualTo(attempt < 2 ? 400 : 429);
        }
        var read = mvc.perform(get("/api/auth/policy").secure(true)).andReturn().getResponse();
        assertThat(read.getStatus()).isEqualTo(200);
        assertThat(read.getHeader("X-Content-Type-Options")).isEqualTo("nosniff");
        assertThat(read.getHeader("X-Frame-Options")).isEqualTo("DENY");
        assertThat(read.getHeader("Strict-Transport-Security")).contains("max-age=");
        assertThat(read.getHeader("Referrer-Policy")).isEqualTo("no-referrer");
        assertThat(read.getHeader("Content-Security-Policy")).contains("default-src 'none'");
    }
}
