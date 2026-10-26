package com.example.fixflow.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import com.sun.net.httpserver.HttpServer;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

class OpenRouterRankingProviderTest {
    @Test void mapsConfiguredProviderOrderWithoutIdentityOrFreeTextAndRejectsMalformedOutput() throws Exception {
        var json = new ObjectMapper();
        var body = new AtomicReference<String>();
        var result = new AtomicReference<>("{\"order\":[1,0]}");
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/chat", exchange -> {
            body.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] response = json.writeValueAsBytes(Map.of("choices", List.of(Map.of("message", Map.of("content", result.get())))));
            exchange.sendResponseHeaders(200, response.length); exchange.getResponseBody().write(response); exchange.close();
        });
        server.start();
        try {
            var provider = new OpenRouterRankingProvider(json, "local-key", "http://127.0.0.1:" + server.getAddress().getPort() + "/chat", "configured-model", 2);
            var candidates = List.of(new TechnicianRankingProvider.Candidate(0, 5, true, 2),
                    new TechnicianRankingProvider.Candidate(1, 4, true, 0));
            assertThat(provider.rank("plumbing", "PRIVATE SPECIALTY", candidates)).containsExactly(1, 0);
            assertThat(body.get()).contains("configured-model", "activeCases").doesNotContain("PRIVATE SPECIALTY", "technicianId", "email", "address");
            result.set("not-json");
            assertThrows(AIProviderException.class, () -> provider.rank("plumbing", null, candidates));
        } finally { server.stop(0); }
    }
}
