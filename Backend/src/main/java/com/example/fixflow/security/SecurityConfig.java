package com.example.fixflow.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

import jakarta.servlet.http.HttpServletResponse;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

	@Bean
	SecurityFilterChain securityFilterChain(HttpSecurity http,
            org.springframework.core.env.Environment environment,
            com.example.fixflow.web.TraceIdFilter traceIdFilter,
            org.springframework.security.web.csrf.CsrfTokenRepository csrfTokens) throws Exception {
		SessionExpiryFilter sessionExpiryFilter = new SessionExpiryFilter(
				org.springframework.boot.convert.DurationStyle.detectAndParse(
						environment.getProperty("fixflow.session.absolute-timeout", "12h")));
        if (environment.getProperty("fixflow.rate-limit.enabled", Boolean.class, true)) {
            http.addFilterBefore(new ApiRateLimitFilter(
                    org.springframework.boot.convert.DurationStyle.detectAndParse(
                            environment.getProperty("fixflow.rate-limit.window", "1m")),
                    environment.getProperty("fixflow.rate-limit.authentication", Integer.class, 20),
                    environment.getProperty("fixflow.rate-limit.writes", Integer.class, 120),
                    environment.getProperty("fixflow.rate-limit.ai", Integer.class, 10),
                    environment.getProperty("fixflow.rate-limit.token-bootstrap", Integer.class, 240),
                    environment.getProperty("fixflow.rate-limit.max-buckets", Integer.class, 10000)),
                    org.springframework.security.web.access.intercept.AuthorizationFilter.class);
        }
		http
				.addFilterBefore(traceIdFilter,
						org.springframework.security.web.context.SecurityContextHolderFilter.class)
				.addFilterAfter(sessionExpiryFilter, com.example.fixflow.web.TraceIdFilter.class)
                .csrf(csrf -> csrf.csrfTokenRepository(csrfTokens)
                        .ignoringRequestMatchers(org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher.withDefaults()
                                .matcher(HttpMethod.POST, "/api/shop/payments/webhook")))
				.cors(Customizer.withDefaults())
                .headers(headers -> headers
                        .addHeaderWriter(new org.springframework.security.web.header.writers.StaticHeadersWriter(
                                "Referrer-Policy", "no-referrer"))
                        .addHeaderWriter(new org.springframework.security.web.header.writers.StaticHeadersWriter(
                                "Permissions-Policy", "camera=(), microphone=(), geolocation=()"))
                        .addHeaderWriter(new org.springframework.security.web.header.writers.DelegatingRequestMatcherHeaderWriter(
                                org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher.withDefaults().matcher("/api/**"),
                                new org.springframework.security.web.header.writers.StaticHeadersWriter("Content-Security-Policy",
                                        "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"))))
				.sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
				.authorizeHttpRequests(auth -> auth
						.requestMatchers("/api/auth/register", "/api/auth/login").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/auth/policy", "/api/auth/csrf").permitAll()
						.requestMatchers(HttpMethod.GET, "/api/shop/catalog").permitAll()
						.requestMatchers(HttpMethod.POST, "/api/shop/payments/webhook").permitAll()
						.requestMatchers("/actuator/health", "/actuator/health/**", "/actuator/info").permitAll()
						.requestMatchers("/v3/api-docs", "/v3/api-docs/**", "/swagger-ui.html", "/swagger-ui/**").permitAll()
						.requestMatchers("/api/admin/shop/**").hasAnyRole("SUPER_ADMIN", "SHOP_MANAGER")
						.requestMatchers("/api/admin/**").hasAnyRole("ADMIN", "SUPER_ADMIN")
						.requestMatchers("/api/**").authenticated()
                        .requestMatchers("/ws/reports").authenticated()
						.anyRequest().permitAll()
				)
				.httpBasic(httpBasic -> httpBasic.disable())
				.formLogin(form -> form.disable())
				.logout(logout -> logout.disable())
				.exceptionHandling(ex -> ex
						.authenticationEntryPoint((request, response, authException) ->
                                writeSecurityError(response, 401, "Unauthorized", "Authentication required", request.getRequestURI()))
						.accessDeniedHandler((request, response, accessDeniedException) -> {
                            boolean csrfFailure = accessDeniedException instanceof org.springframework.security.web.csrf.CsrfException;
                            if (csrfFailure) {
                                response.setHeader("Cache-Control", "no-store");
                                response.setHeader("X-CSRF-Error", "invalid-token");
                            }
                            writeSecurityError(response, 403, "Forbidden", csrfFailure
                                    ? "CSRF token missing or invalid; refresh the token before trying again"
                                    : "Access denied", request.getRequestURI());
                        })
				);

		return http.build();
	}

    private static void writeSecurityError(HttpServletResponse response, int status, String error,
            String message, String path) throws java.io.IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write(new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(
                com.example.fixflow.web.ApiError.of(status, error, message, path).asMap()));
    }

	@Bean
	org.springframework.security.web.csrf.CsrfTokenRepository csrfTokens() {
        return new org.springframework.security.web.csrf.HttpSessionCsrfTokenRepository();
    }

	@Bean
	PasswordEncoder passwordEncoder() {
		return new BCryptPasswordEncoder();
	}

	@Bean
	AuthenticationManager authenticationManager(AuthenticationConfiguration configuration) throws Exception {
		return configuration.getAuthenticationManager();
	}

	@Bean
	CorsConfigurationSource corsConfigurationSource(org.springframework.core.env.Environment environment) {
		CorsConfiguration config = new CorsConfiguration();
		config.setAllowedOriginPatterns(java.util.Arrays.stream(environment.getProperty(
                "fixflow.cors.allowed-origin-patterns", "http://localhost:*,http://127.0.0.1:*")
                .split(",")).map(String::trim).filter(value -> !value.isEmpty()).toList());
		config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
		config.setAllowedHeaders(List.of("*"));
        config.setExposedHeaders(List.of("X-CSRF-Error", "Retry-After"));
		config.setAllowCredentials(true);
		UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
		source.registerCorsConfiguration("/**", config);
		return source;
	}
}
