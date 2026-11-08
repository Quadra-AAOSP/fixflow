package com.example.fixflow.security;

import java.io.IOException;
import java.util.Set;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;
import com.example.fixflow.domain.UserRole;
import com.example.fixflow.repository.SiteAdminApplicationRepository;
import com.example.fixflow.repository.UserRepository;
import com.example.fixflow.web.ApiError;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

public class ApplicationAccessFilter extends OncePerRequestFilter {
    private static final Set<String> ALLOWED = Set.of("/api/auth/me", "/api/auth/logout",
            "/api/auth/csrf", "/api/auth/site-admin-application", "/api/auth/login");
    private final SiteAdminApplicationRepository applications;
    private final UserRepository users;

    public ApplicationAccessFilter(SiteAdminApplicationRepository applications, UserRepository users) {
        this.applications = applications;
        this.users = users;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof AppUserDetails actor
                && actor.getRole() == UserRole.reporter
                && applications.findByUser_Id(actor.getId()).isPresent()) {
            var current = users.findById(actor.getId()).orElse(null);
            boolean roleChanged = current == null || current.getRole() != actor.getRole();
            String path = request.getRequestURI().substring(request.getContextPath().length());
            if ((roleChanged && !path.equals("/api/auth/logout") && !path.equals("/api/auth/login")
                    && !path.equals("/api/auth/csrf") && !path.equals("/api/auth/site-admin-application"))
                    || (!roleChanged && !ALLOWED.contains(path))) {
                int status = roleChanged ? 401 : 403;
                response.setStatus(status);
                response.setContentType("application/json");
                response.setCharacterEncoding("UTF-8");
                new ObjectMapper().writeValue(response.getWriter(), ApiError.of(status,
                        roleChanged ? "Unauthorized" : "Forbidden",
                        roleChanged ? "Sign in again to refresh your access" : "Application approval required",
                        request.getRequestURI()).asMap());
                return;
            }
        }
        chain.doFilter(request, response);
    }
}
