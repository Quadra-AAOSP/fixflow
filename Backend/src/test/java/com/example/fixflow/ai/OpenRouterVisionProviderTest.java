package com.example.fixflow.ai;

import static org.assertj.core.api.Assertions.*;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import com.sun.net.httpserver.HttpServer;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.example.fixflow.ai.dto.VisionClassificationRequest;

class OpenRouterVisionProviderTest {
    private HttpServer server;
    private final List<String> bodies = new CopyOnWriteArrayList<>();
    private boolean malformed;
    @BeforeEach void start() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/chat", exchange -> {
            String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            bodies.add(body);
            boolean primary = body.contains("primary-vision");
            String content = malformed ? "not-json" : "{\"category\":\"plumbing\",\"specialty\":null,\"urgency\":\"high\",\"description\":\"Visible leaking pipe\",\"urgency_reason\":\"Water may damage nearby equipment\"}";
            byte[] response = new ObjectMapper().writeValueAsBytes(java.util.Map.of("choices", List.of(
                    java.util.Map.of("message", java.util.Map.of("content", content)))));
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(primary ? 503 : 200, response.length);
            exchange.getResponseBody().write(response); exchange.close();
        });
        server.start();
    }
    @AfterEach void stop() { server.stop(0); }
    private OpenRouterVisionProvider provider() {
        return new OpenRouterVisionProvider(new ObjectMapper(), "fake-key",
                "http://127.0.0.1:" + server.getAddress().getPort() + "/chat",
                "primary-vision", "fallback-vision", 2, 256);
    }
    private VisionClassificationRequest request() {
        return VisionClassificationRequest.builder().imageData(new byte[] {1,2,3})
                .mimeType("image/png").description("Pipe leak").address("DO NOT TRANSMIT THIS ADDRESS")
                .allowedCategories(List.of("plumbing", "general")).build();
    }
    @Test void usesImageContentAndFallsBackWithoutSendingAddress() throws Exception {
        var result = provider().classifyImage(request());
        assertThat(result.getModel()).isEqualTo("fallback-vision");
        assertThat(result.getCategory()).isEqualTo("plumbing");
        assertThat(bodies).hasSize(2);
        assertThat(bodies.get(1)).contains("image_url", "data:image/png;base64,AQID")
                .doesNotContain("DO NOT TRANSMIT THIS ADDRESS", "fake-key");
    }
    @Test void malformedResultsAreNotAccepted() {
        malformed = true;
        assertThatThrownBy(() -> provider().classifyImage(request())).isInstanceOf(AIProviderException.class);
    }
}
