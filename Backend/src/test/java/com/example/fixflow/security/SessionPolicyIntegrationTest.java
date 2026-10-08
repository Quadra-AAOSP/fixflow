package com.example.fixflow.security;

import static org.assertj.core.api.Assertions.assertThat;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.session.Session;
import org.springframework.session.SessionRepository;
import com.example.fixflow.domain.User;
import com.example.fixflow.domain.UserRole;
import com.example.fixflow.repository.UserRepository;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
    "spring.datasource.url=jdbc:h2:mem:session-policy;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE",
    "spring.session.timeout=60s", "fixflow.session.absolute-timeout=12h",
    "server.servlet.session.cookie.secure=true", "server.servlet.session.cookie.http-only=true",
    "server.servlet.session.cookie.same-site=lax"})
class SessionPolicyIntegrationTest {
    @LocalServerPort int port;
    @Autowired UserRepository users;
    @Autowired PasswordEncoder encoder;
    // JdbcSession is package-private; use its public Session/SessionRepository APIs.
    @Autowired @SuppressWarnings("rawtypes") SessionRepository sessions;
    private final HttpClient client = HttpClient.newHttpClient();
    private String email;

    @BeforeEach
    void createUser() {
        email = "session-" + System.nanoTime() + "@example.com";
        User user = new User();
        user.setEmail(email); user.setPasswordHash(encoder.encode("password123"));
        user.setFirstName("Session"); user.setLastName("Test"); user.setRole(UserRole.technician);
        users.save(user);
    }

    private HttpResponse<String> login(String cookie) throws Exception {
        var builder = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/auth/login"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString("{\"email\":\"" + email + "\",\"password\":\"password123\"}"));
        if (cookie != null) builder.header("Cookie", cookie);
        return client.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    }

    private String cookie(HttpResponse<String> response) {
        return response.headers().allValues("set-cookie").stream()
                .filter(value -> value.startsWith("SESSION=")).findFirst().orElseThrow().split(";", 2)[0];
    }

    private String id(String cookie) {
        return new String(Base64.getDecoder().decode(cookie.substring("SESSION=".length())), java.nio.charset.StandardCharsets.UTF_8);
    }

    private HttpResponse<String> me(String cookie) throws Exception {
        return client.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/auth/me"))
                .header("Cookie", cookie).GET().build(), HttpResponse.BodyHandlers.ofString());
    }

    @Test void productionCookieIsSecureHttpOnlyAndSameSite() throws Exception {
        var response = login(null);
        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.headers().allValues("set-cookie").toString()).contains("Secure", "HttpOnly", "SameSite=Lax");
        Session session = sessions.findById(id(cookie(response)));
        assertThat(session).isNotNull();
        assertThat(session.getMaxInactiveInterval()).isEqualTo(Duration.ofSeconds(60));
    }

    @Test void idleExpiryRejectsOldCookie() throws Exception {
        String cookie = cookie(login(null));
        Session session = sessions.findById(id(cookie));
        session.setLastAccessedTime(Instant.now().minusSeconds(120));
        sessions.save(session);
        assertThat(me(cookie).statusCode()).isEqualTo(401);
        assertThat(sessions.findById(id(cookie))).isNull();
    }

    @Test void activityRenewsIdleButNotAbsoluteDeadline() throws Exception {
        String cookie = cookie(login(null));
        Session session = sessions.findById(id(cookie));
        Instant started = session.getAttribute(SessionExpiryFilter.AUTHENTICATED_AT);
        Instant earlier = Instant.now().minusSeconds(20);
        session.setLastAccessedTime(earlier); sessions.save(session);
        assertThat(me(cookie).statusCode()).isEqualTo(200);
        Session renewed = sessions.findById(id(cookie));
        assertThat(renewed.getLastAccessedTime()).isAfter(earlier);
        assertThat((Instant) renewed.getAttribute(SessionExpiryFilter.AUTHENTICATED_AT)).isEqualTo(started);
        renewed.setAttribute(SessionExpiryFilter.AUTHENTICATED_AT, Instant.now().minus(Duration.ofHours(13)));
        sessions.save(renewed);
        assertThat(me(cookie).statusCode()).isEqualTo(401);
        assertThat(sessions.findById(id(cookie))).isNull();
    }

    @Test void loginRotatesIdAndLogoutInvalidatesCookie() throws Exception {
        String old = cookie(login(null));
        String rotated = cookie(login(old));
        assertThat(rotated).isNotEqualTo(old);
        assertThat(me(old).statusCode()).isEqualTo(401);
        assertThat(me(rotated).statusCode()).isEqualTo(200);
        var logout = client.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/auth/logout"))
                .header("Cookie", rotated).POST(HttpRequest.BodyPublishers.noBody()).build(), HttpResponse.BodyHandlers.ofString());
        assertThat(logout.statusCode()).isEqualTo(204);
        assertThat(me(rotated).statusCode()).isEqualTo(401);
    }
}
