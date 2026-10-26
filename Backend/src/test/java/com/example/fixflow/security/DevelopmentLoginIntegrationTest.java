package com.example.fixflow.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.security.crypto.password.PasswordEncoder;
import com.example.fixflow.domain.User;
import com.example.fixflow.domain.UserRole;
import com.example.fixflow.repository.UserRepository;
import com.example.fixflow.repository.SiteRepository;
import com.example.fixflow.domain.Site;
import com.example.fixflow.domain.SiteType;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
    "spring.datasource.url=jdbc:h2:mem:development-login;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE",
    "server.servlet.session.cookie.secure=",
    "fixflow.cors.allowed-origin-patterns=http://localhost:*,http://192.168.1.20:8081"})
class DevelopmentLoginIntegrationTest {
    @LocalServerPort int port;
    @Autowired UserRepository users;
    @Autowired PasswordEncoder encoder;
    @Autowired SiteRepository sites;

    @Test void reporterRegistrationThenLoginRetainsSession() throws Exception {
        Site site = new Site(); site.setName("Registration school"); site.setType(SiteType.school);
        site = sites.save(site);
        String email = "reporter-" + System.nanoTime() + "@example.test";
        var client = HttpClient.newBuilder()
                .cookieHandler(new CookieManager(null, CookiePolicy.ACCEPT_ALL)).build();
        String registration = "{\"email\":\"" + email + "\",\"password\":\"FixflowDemo!2026\","
                + "\"firstName\":\"Test\",\"lastName\":\"Reporter\",\"role\":\"reporter\",\"siteId\":"
                + site.getId() + "}";
        var created = client.send(CsrfHttp.authorize(client, HttpRequest.newBuilder(uri("/api/auth/register"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(registration)), uri("/"), null).build(),
                HttpResponse.BodyHandlers.ofString());
        assertThat(created.statusCode()).isEqualTo(201);
        var loggedIn = client.send(CsrfHttp.authorize(client, HttpRequest.newBuilder(uri("/api/auth/login"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString("{\"email\":\"" + email
                        + "\",\"password\":\"FixflowDemo!2026\"}")), uri("/"), null).build(),
                HttpResponse.BodyHandlers.ofString());
        assertThat(loggedIn.statusCode()).isEqualTo(200);
        var me = client.send(HttpRequest.newBuilder(uri("/api/auth/me")).GET().build(),
                HttpResponse.BodyHandlers.ofString());
        assertThat(me.statusCode()).isEqualTo(200);
        assertThat(me.body()).contains(email);
    }

    @Test void httpLoginRetainsCookieAndLogoutInvalidatesIt() throws Exception {
        String email = "development-" + System.nanoTime() + "@example.test";
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(encoder.encode("FixflowDemo!2026"));
        user.setFirstName("Development"); user.setLastName("Admin");
        user.setRole(UserRole.super_admin); users.save(user);
        var jar = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
        var client = HttpClient.newBuilder().cookieHandler(jar).build();
        var login = client.send(CsrfHttp.authorize(client, HttpRequest.newBuilder(uri("/api/auth/login"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString("{\"email\":\"" + email
                        + "\",\"password\":\"FixflowDemo!2026\"}"))
                , uri("/"), null).build(), HttpResponse.BodyHandlers.ofString());
        assertThat(login.statusCode()).isEqualTo(200);
        String cookie = login.headers().firstValue("set-cookie").orElseThrow();
        assertThat(cookie).contains("HttpOnly", "SameSite=Lax").doesNotContain("Secure");
        assertThat(client.send(HttpRequest.newBuilder(uri("/api/auth/me")).GET().build(),
                HttpResponse.BodyHandlers.ofString()).statusCode()).isEqualTo(200);
        assertThat(client.send(CsrfHttp.authorize(client, HttpRequest.newBuilder(uri("/api/auth/logout"))
                .POST(HttpRequest.BodyPublishers.noBody()), uri("/"), null).build(),
                HttpResponse.BodyHandlers.ofString()).statusCode()).isEqualTo(204);
        assertThat(client.send(HttpRequest.newBuilder(uri("/api/auth/me")).GET().build(),
                HttpResponse.BodyHandlers.ofString()).statusCode()).isEqualTo(401);
    }

    @Test void configuredLanBrowserCanPreflightButUntrustedOriginCannot() throws Exception {
        var client = HttpClient.newHttpClient();
        for (String origin : new String[]{"http://192.168.1.20:8081", "https://untrusted.example"}) {
            var result = client.send(HttpRequest.newBuilder(uri("/api/auth/login"))
                    .header("Origin", origin).header("Access-Control-Request-Method", "POST")
                    .header("Access-Control-Request-Headers", "content-type")
                    .method("OPTIONS", HttpRequest.BodyPublishers.noBody()).build(),
                    HttpResponse.BodyHandlers.ofString());
            assertThat(result.statusCode()).isEqualTo(origin.startsWith("http://192") ? 200 : 403);
            if (result.statusCode() == 200) {
                assertThat(result.headers().firstValue("access-control-allow-origin")).contains(origin);
                assertThat(result.headers().firstValue("access-control-allow-credentials")).contains("true");
            }
        }
    }

    @Test void seedPasswordHashMatchesDocumentedPassword() {
        assertThat(encoder.matches("FixflowDemo!2026",
                "$2a$10$yuE7oCzjn3XkneC9fm.KB.pvjWgPd0nE8L9Ah0WnU558ACYt..NTG")).isTrue();
    }

    private URI uri(String path) { return URI.create("http://localhost:" + port + path); }
}
