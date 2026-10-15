package com.example.fixflow.realtime;

import java.util.Arrays;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.server.HandshakeInterceptor;

@Configuration
@EnableWebSocket
@EnableScheduling
public class ReportWebSocketConfig implements WebSocketConfigurer {
    private final ReportWebSocketHandler handler;
    private final RealtimeAccess access;
    private final String[] origins;

    public ReportWebSocketConfig(ReportWebSocketHandler handler, RealtimeAccess access,
            @Value("${fixflow.websocket.allowed-origins:http://localhost:5173,http://127.0.0.1:5173,http://localhost:8081,http://127.0.0.1:8081}") String origins) {
        this.handler = handler; this.access = access;
        this.origins = Arrays.stream(origins.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toArray(String[]::new);
        if (this.origins.length == 0) throw new IllegalArgumentException("WebSocket origins must be explicit");
        for (String origin : this.origins) {
            var uri = java.net.URI.create(origin);
            if (origin.contains("*") || uri.getHost() == null || uri.getUserInfo() != null
                    || !(uri.getScheme().equals("https") || uri.getScheme().equals("http"))
                    || uri.getRawQuery() != null || uri.getRawFragment() != null || !uri.getPath().isEmpty()) {
                throw new IllegalArgumentException("WebSocket origin must be an exact HTTP(S) origin");
            }
        }
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(handler, "/ws/reports").setAllowedOrigins(origins).addInterceptors(new HandshakeInterceptor() {
            @Override
            public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                    WebSocketHandler webSocketHandler, Map<String, Object> attributes) {
                if (!Arrays.asList(origins).contains(request.getHeaders().getOrigin())) {
                    response.setStatusCode(HttpStatus.FORBIDDEN); return false;
                }
                if (!(request instanceof ServletServerHttpRequest servlet)) {
                    response.setStatusCode(HttpStatus.UNAUTHORIZED); return false;
                }
                var session = servlet.getServletRequest().getSession(false);
                try {
                    if (session == null) { response.setStatusCode(HttpStatus.UNAUTHORIZED); return false; }
                    access.actor(session.getId());
                    attributes.put(ReportWebSocketHandler.HTTP_SESSION_ID, session.getId()); return true;
                } catch (RuntimeException ex) { response.setStatusCode(HttpStatus.UNAUTHORIZED); return false; }
            }

            @Override
            public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                    WebSocketHandler webSocketHandler, Exception exception) { }
        });
    }
}
