package com.example.fixflow.security;

import static org.assertj.core.api.Assertions.assertThat;
import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Map;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.example.fixflow.domain.User;
import com.example.fixflow.domain.UserRole;
import com.example.fixflow.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.security.crypto.password.PasswordEncoder;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
    "spring.datasource.url=jdbc:h2:mem:csrf-api;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE",
    "server.servlet.session.cookie.secure=false"})
class CsrfIntegrationTest {
    @LocalServerPort int port;
    @Autowired UserRepository users;
    @Autowired PasswordEncoder passwords;
    private final ObjectMapper json = new ObjectMapper();

    private HttpClient client() {
        return HttpClient.newBuilder().cookieHandler(new CookieManager(null, CookiePolicy.ACCEPT_ALL)).build();
    }
    private URI uri(String path) { return URI.create("http://localhost:" + port + path); }
    private HttpResponse<String> send(HttpClient client, String path, String token, String body) throws Exception {
        var request = HttpRequest.newBuilder(uri(path)).header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body));
        if (token != null) request.header("X-CSRF-TOKEN", token);
        return client.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }
    private String token(HttpClient client) throws Exception {
        var response = client.send(HttpRequest.newBuilder(uri("/api/auth/csrf")).GET().build(),
                HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.headers().firstValue("cache-control")).contains("no-store");
        assertThat(json.readTree(response.body()).path("headerName").asText()).isEqualTo("X-CSRF-TOKEN");
        return json.readTree(response.body()).path("token").asText();
    }

    @Test void missingForgedAndOtherSessionTokensCannotWrite() throws Exception {
        var client = client();
        for (String path : new String[]{"/api/auth/login", "/api/auth/register", "/api/auth/logout", "/api/reports"}) {
            var response = send(client, path, null, "{}");
            assertThat(response.statusCode()).isEqualTo(403);
            assertThat(response.headers().firstValue("X-CSRF-Error")).contains("invalid-token");
        }
        assertThat(send(client, "/api/auth/login", "forged", "{}").statusCode()).isEqualTo(403);
        String foreign = token(client());
        token(client);
        assertThat(send(client, "/api/auth/login", foreign, "{}").statusCode()).isEqualTo(403);
        // Valid token reaches validation, not a bypass of authentication/domain rules.
        assertThat(send(client, "/api/auth/login", token(client), "{}").statusCode()).isEqualTo(400);
    }

    @Test void loginRotatesTokenAndLogoutInvalidatesIt() throws Exception {
        User user = new User();
        user.setEmail("csrf-" + System.nanoTime() + "@example.test");
        user.setPasswordHash(passwords.encode("csrf-test-password"));
        user.setFirstName("CSRF"); user.setLastName("Test"); user.setRole(UserRole.technician);
        users.save(user);
        var client = client();
        String before = token(client);
        var login = send(client, "/api/auth/login", before,
                json.writeValueAsString(Map.of("email", user.getEmail(), "password", "csrf-test-password")));
        assertThat(login.statusCode()).isEqualTo(200);
        assertThat(send(client, "/api/auth/logout", before, "{}").statusCode()).isEqualTo(403);
        assertThat(client.send(HttpRequest.newBuilder(uri("/api/auth/me")).GET().build(),
                HttpResponse.BodyHandlers.ofString()).statusCode()).isEqualTo(200);
        String afterLogin = token(client);
        assertThat(send(client, "/api/auth/logout", afterLogin, "{}").statusCode()).isEqualTo(204);
        assertThat(send(client, "/api/auth/login", afterLogin, "{}").statusCode()).isEqualTo(403);
        assertThat(send(client, "/api/auth/login", token(client), "{}").statusCode()).isEqualTo(400);
    }

    @Test void preflightPermitsTokenHeaderAndWebhookAloneIsExempt() throws Exception {
        var client = client();
        var preflight = client.send(HttpRequest.newBuilder(uri("/api/auth/login"))
                .header("Origin", "http://localhost:8081")
                .header("Access-Control-Request-Method", "POST")
                .header("Access-Control-Request-Headers", "content-type,x-csrf-token")
                .method("OPTIONS", HttpRequest.BodyPublishers.noBody()).build(), HttpResponse.BodyHandlers.ofString());
        assertThat(preflight.statusCode()).isEqualTo(200);
        var webhook = send(client, "/api/shop/payments/webhook", null, "{}");
        assertThat(webhook.headers().firstValue("X-CSRF-Error")).isEmpty();
        assertThat(webhook.statusCode()).isGreaterThanOrEqualTo(400); // Invalid payment, never accepted blindly.
        var developmentPayment = send(client, "/api/shop/payments/dev/complete/nonexistent", null, "{}");
        assertThat(developmentPayment.statusCode()).isEqualTo(403);
        assertThat(developmentPayment.headers().firstValue("X-CSRF-Error")).contains("invalid-token");
    }
}
