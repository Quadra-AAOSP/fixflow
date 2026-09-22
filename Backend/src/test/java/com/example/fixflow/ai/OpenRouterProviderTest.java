package com.example.fixflow.ai;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

import com.example.fixflow.ai.dto.ClassificationRequest;
import com.example.fixflow.ai.dto.ClassificationResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class OpenRouterProviderTest {

    private final AtomicReference<String> requestBody = new AtomicReference<>();
    private HttpServer server;

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/chat/completions", exchange -> {
            requestBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] response = """
                    {"choices":[{"message":{"content":"{\\"category\\":\\"plumbing\\",\\"specialty\\":\\"leak\\",\\"urgency\\":\\"high\\"}"}}]}
                    """.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, response.length);
            exchange.getResponseBody().write(response);
            exchange.close();
        });
        server.start();
    }

    @AfterEach
    void stopServer() {
        server.stop(0);
    }

    @Test
    void classifiesUsingConfiguredOpenRouterSettings() throws Exception {
        OpenRouterProvider provider = provider("test-api-key");
        ClassificationRequest request = ClassificationRequest.builder()
                .description("Water is leaking from the sink")
                .siteType("hostel")
                .address("Room 12")
                .allowedCategories(List.of("plumbing", "electrical"))
                .build();

        ClassificationResponse response = provider.classifyText(request);

        assertEquals("plumbing", response.getCategory());
        assertEquals("leak", response.getSpecialty());
        assertEquals("high", response.getUrgency());
        assertEquals("OpenRouter", response.getProvider());
        assertEquals("test-model", response.getModel());
        assertTrue(requestBody.get().contains("\"model\":\"test-model\""));
        assertTrue(requestBody.get().contains("\"max_tokens\":321"));
        assertTrue(requestBody.get().contains("\"temperature\":0.25"));
    }

    @Test
    void rejectsClassificationWhenApiKeyIsMissing() {
        OpenRouterProvider provider = provider("");
        ClassificationRequest request = ClassificationRequest.builder()
                .description("Broken light")
                .siteType("school")
                .allowedCategories(List.of("electrical"))
                .build();

        AIProviderException exception = assertThrows(
                AIProviderException.class,
                () -> provider.classifyText(request));

        assertEquals(AIProviderException.AIErrorType.AUTHENTICATION_ERROR, exception.getErrorType());
    }

    private OpenRouterProvider provider(String apiKey) {
        return new OpenRouterProvider(
                new ObjectMapper(),
                apiKey,
                "test-model",
                "http://127.0.0.1:" + server.getAddress().getPort() + "/chat/completions",
                5,
                1,
                1,
                0.25,
                321);
    }
}
