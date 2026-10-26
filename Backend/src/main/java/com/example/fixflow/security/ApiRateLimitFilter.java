package com.example.fixflow.security;

import java.io.IOException;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.function.LongSupplier;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;
import com.example.fixflow.web.ApiError;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/** Local fixed-window limits; peer addresses are never taken from untrusted forwarding headers. */
public class ApiRateLimitFilter extends OncePerRequestFilter {
    private record Bucket(long started, int used) { }
    private final Map<String, Bucket> buckets = new HashMap<>();
    private final long window;
    private final int authentication, writes, ai, bootstrap, capacity;
    private final LongSupplier ticker;
    private final ObjectMapper json = new ObjectMapper();

    public ApiRateLimitFilter(Duration window, int authentication, int writes, int ai, int bootstrap, int capacity) {
        this(window, authentication, writes, ai, bootstrap, capacity, System::nanoTime);
    }

    ApiRateLimitFilter(Duration window, int authentication, int writes, int ai, int bootstrap, int capacity,
            LongSupplier ticker) {
        if (window.isNegative() || window.isZero() || window.compareTo(Duration.ofHours(1)) > 0
                || authentication < 1 || writes < 1 || ai < 1 || bootstrap < 1 || capacity < 1) {
            throw new IllegalArgumentException("Rate limits must be positive; window must be at most one hour");
        }
        this.window = window.toNanos(); this.authentication = authentication; this.writes = writes;
        this.ai = ai; this.bootstrap = bootstrap; this.capacity = capacity; this.ticker = ticker;
    }

    @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
            FilterChain chain) throws ServletException, IOException {
        String path = request.getServletPath();
        if (path.isEmpty()) path = request.getRequestURI().substring(request.getContextPath().length());
        String method = request.getMethod();
        String scope;
        int limit;
        boolean ipOnly = false;
        if (method.equals("POST") && (path.equals("/api/auth/login") || path.equals("/api/auth/register"))) {
            scope = "authentication"; limit = authentication; ipOnly = true;
        } else if (method.equals("GET") && path.equals("/api/auth/csrf")) {
            scope = "token"; limit = bootstrap; ipOnly = true;
        } else if (method.equals("POST") && path.matches("/api/reports/[0-9]+/(classify|technician-ranking|vision)")) {
            scope = "ai"; limit = ai;
        } else if (path.startsWith("/api/") && !java.util.Set.of("GET", "HEAD", "OPTIONS").contains(method)
                && !path.equals("/api/auth/logout") && !path.equals("/api/shop/payments/webhook")) {
            scope = "writes"; limit = writes;
        } else {
            chain.doFilter(request, response); return;
        }
        var auth = SecurityContextHolder.getContext().getAuthentication();
        String subject = !ipOnly && auth != null && auth.getPrincipal() instanceof AppUserDetails user
                ? "user:" + user.getId() : "peer:" + request.getRemoteAddr();
        long retry = acquire(scope + ":" + subject, limit);
        if (retry == 0) { chain.doFilter(request, response); return; }
        response.setStatus(429);
        response.setContentType("application/json"); response.setCharacterEncoding("UTF-8");
        response.setHeader("Retry-After", Long.toString(retry));
        response.setHeader("Cache-Control", "no-store");
        json.writeValue(response.getWriter(), ApiError.of(429, "Too Many Requests", "RATE_LIMITED",
                "Too many requests; wait before trying again", request.getRequestURI(),
                com.example.fixflow.web.TraceIdFilter.currentTraceId(), null).asMap());
    }

    // ponytail: per-process synchronized buckets; use a shared limiter at the gateway before scaling replicas.
    private synchronized long acquire(String key, int limit) {
        long now = ticker.getAsLong();
        Bucket bucket = buckets.get(key);
        if (bucket == null || now - bucket.started() >= window) {
            if (bucket == null && buckets.size() >= capacity) {
                buckets.entrySet().removeIf(entry -> now - entry.getValue().started() >= window);
                if (buckets.size() >= capacity) return seconds(window);
            }
            buckets.put(key, new Bucket(now, 1)); return 0;
        }
        if (bucket.used() >= limit) return seconds(window - (now - bucket.started()));
        buckets.put(key, new Bucket(bucket.started(), bucket.used() + 1)); return 0;
    }

    private long seconds(long nanos) { return Math.max(1, (nanos + 999_999_999L) / 1_000_000_000L); }
}
