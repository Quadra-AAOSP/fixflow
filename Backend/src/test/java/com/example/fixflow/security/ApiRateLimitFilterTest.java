package com.example.fixflow.security;

import static org.assertj.core.api.Assertions.assertThat;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.Executors;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import com.example.fixflow.domain.User;
import com.example.fixflow.domain.UserRole;

class ApiRateLimitFilterTest {
    private final AtomicLong clock = new AtomicLong();
    private final AtomicInteger delivered = new AtomicInteger();
    @AfterEach void clearSecurity() { SecurityContextHolder.clearContext(); }
    private ApiRateLimitFilter filter(int capacity) {
        return new ApiRateLimitFilter(Duration.ofSeconds(60), 2, 2, 1, 2, capacity, clock::get);
    }
    private MockHttpServletResponse request(ApiRateLimitFilter filter, String method, String path, String peer)
            throws Exception {
        var request = new MockHttpServletRequest(method, path); request.setRemoteAddr(peer);
        request.addHeader("X-Forwarded-For", "forged-" + System.nanoTime());
        var response = new MockHttpServletResponse();
        filter.doFilter(request, response, (req, res) -> delivered.incrementAndGet());
        return response;
    }

    @Test void authenticationLimitHasSafeJsonRetryAfterAndExpiresWithoutTrustingForwardedHeaders() throws Exception {
        var filter = filter(10);
        request(filter, "POST", "/api/auth/login", "peer");
        request(filter, "POST", "/api/auth/register", "peer");
        var blocked = request(filter, "POST", "/api/auth/login", "peer");
        assertThat(blocked.getStatus()).isEqualTo(429);
        assertThat(blocked.getHeader("Retry-After")).isEqualTo("60");
        assertThat(blocked.getContentAsString()).contains("RATE_LIMITED").doesNotContain("forged-");
        assertThat(delivered.get()).isEqualTo(2);
        clock.set(Duration.ofSeconds(60).toNanos());
        assertThat(request(filter, "POST", "/api/auth/login", "peer").getStatus()).isEqualTo(200);
    }

    @Test void usersHaveIndependentWriteLimitsWhileAiReportsShareOneQuota() throws Exception {
        var filter = filter(10);
        User user = new User(); user.setId(1L); user.setRole(UserRole.admin);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(new AppUserDetails(user), null, List.of()));
        request(filter, "POST", "/api/reports/1/classify", "peer");
        assertThat(request(filter, "POST", "/api/reports/2/technician-ranking", "different-peer").getStatus()).isEqualTo(429);
        request(filter, "POST", "/api/reports", "peer");
        request(filter, "PUT", "/api/sites/1", "peer");
        assertThat(request(filter, "DELETE", "/api/reports/1/photos/2", "peer").getStatus()).isEqualTo(429);
        user.setId(2L);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(new AppUserDetails(user), null, List.of()));
        assertThat(request(filter, "POST", "/api/reports", "peer").getStatus()).isEqualTo(200);
    }

    @Test void boundedStateFailsClosedThenRecoversAndDoesNotBlockLogoutReadsOrWebhook() throws Exception {
        var filter = filter(1);
        request(filter, "POST", "/api/auth/login", "one");
        assertThat(request(filter, "POST", "/api/auth/login", "two").getStatus()).isEqualTo(429);
        for (String path : List.of("/api/auth/logout", "/api/shop/payments/webhook")) {
            assertThat(request(filter, "POST", path, "two").getStatus()).isEqualTo(200);
        }
        assertThat(request(filter, "GET", "/api/reports", "two").getStatus()).isEqualTo(200);
        clock.set(Duration.ofMinutes(1).toNanos());
        assertThat(request(filter, "POST", "/api/auth/login", "two").getStatus()).isEqualTo(200);
    }

    @Test void tokenBootstrapIsLimitedAndSimultaneousRequestsCannotOverrunQuota() throws Exception {
        var filter = filter(10);
        try (var executor = Executors.newFixedThreadPool(8)) {
            var tasks = java.util.stream.IntStream.range(0, 20)
                    .<java.util.concurrent.Callable<Integer>>mapToObj(i -> () ->
                            request(filter, "GET", "/api/auth/csrf", "peer").getStatus()).toList();
            long accepted = 0;
            for (var result : executor.invokeAll(tasks)) if (result.get() == 200) accepted++;
            assertThat(accepted).isEqualTo(2);
        }
    }
}
