package com.example.fixflow.security;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.security.core.context.SecurityContextHolder;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

/** JDBC sessions renew their idle deadline on access, never their absolute deadline. */
public class SessionExpiryFilter extends OncePerRequestFilter {
    public static final String AUTHENTICATED_AT = "fixflow.authenticatedAt";
    private final Duration absoluteTimeout;

    public SessionExpiryFilter(Duration absoluteTimeout) {
        if (absoluteTimeout.isZero() || absoluteTimeout.isNegative()) {
            throw new IllegalArgumentException("Session absolute timeout must be positive");
        }
        this.absoluteTimeout = absoluteTimeout;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
            FilterChain chain) throws ServletException, IOException {
        HttpSession session = request.getSession(false);
        if (session != null) {
            Object started = session.getAttribute(AUTHENTICATED_AT);
            // Existing sessions issued before this policy also have a bounded lifetime.
            Instant authenticatedAt = started instanceof Instant instant
                    ? instant : Instant.ofEpochMilli(session.getCreationTime());
            if (!Instant.now().isBefore(authenticatedAt.plus(absoluteTimeout))) {
                session.invalidate();
                SecurityContextHolder.clearContext();
            }
        }
        chain.doFilter(request, response);
    }
}
