package com.example.fixflow.realtime;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import com.example.fixflow.security.SessionEnded;
import com.fasterxml.jackson.databind.ObjectMapper;

@Component
public class ReportWebSocketHandler extends TextWebSocketHandler {
    public static final String HTTP_SESSION_ID = "fixflow.httpSessionId";
    private final RealtimeAccess access;
    private final ObjectMapper json = new ObjectMapper();
    private final Map<String, Client> clients = new ConcurrentHashMap<>();

    private record Client(WebSocketSession socket, String sessionId, Long userId, Set<String> subscriptions) { }

    public ReportWebSocketHandler(RealtimeAccess access) { this.access = access; }

    @Override
    public synchronized void afterConnectionEstablished(WebSocketSession socket) throws IOException {
        String sessionId = (String) socket.getAttributes().get(HTTP_SESSION_ID);
        try {
            Long userId = access.actor(sessionId).getId();
            if (clients.values().stream().filter(c -> c.userId().equals(userId)).count() >= 5) {
                socket.close(CloseStatus.POLICY_VIOLATION); return;
            }
            socket.setTextMessageSizeLimit(4096);
            clients.put(socket.getId(), new Client(new ConcurrentWebSocketSessionDecorator(socket, 5000, 65536),
                    sessionId, userId, ConcurrentHashMap.newKeySet()));
        } catch (RuntimeException ex) { socket.close(CloseStatus.POLICY_VIOLATION); }
    }

    @Override
    protected void handleTextMessage(WebSocketSession socket, TextMessage message) {
        Client client = clients.get(socket.getId());
        if (client == null) return;
        try {
            access.actor(client.sessionId());
            if (message.getPayloadLength() > 4096) throw new IllegalArgumentException("Frame too large");
            var input = json.readTree(message.getPayload());
            if (!input.isObject() || input.size() != 2 || !input.path("action").isTextual()
                    || !input.path("destination").isTextual()) throw new IllegalArgumentException("Invalid frame");
            String action = input.get("action").asText();
            String destination = input.get("destination").asText();
            if (action.equals("subscribe")) {
                access.authorize(client.sessionId(), destination);
                if (client.subscriptions().size() >= 64 && !client.subscriptions().contains(destination)) {
                    throw new IllegalArgumentException("Too many subscriptions");
                }
                client.subscriptions().add(destination);
                control(client, "subscribed", destination);
            } else if (action.equals("unsubscribe")) {
                client.subscriptions().remove(destination);
                control(client, "unsubscribed", destination);
            } else {
                // No SEND/publish/STOMP/application-command route exists for clients.
                throw new IllegalArgumentException("Client publication is forbidden");
            }
        } catch (IOException | RuntimeException ex) { close(client); }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession socket, CloseStatus status) { clients.remove(socket.getId()); }

    @Override
    public void handleTransportError(WebSocketSession socket, Throwable error) {
        Client client = clients.get(socket.getId());
        if (client != null) close(client);
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = false)
    public void reportCommitted(ReportDomainEvent event) {
        for (Client client : clients.values()) {
            for (String destination : Set.copyOf(client.subscriptions())) {
                boolean site = destination.equals("/sites/" + event.siteId() + "/events");
                boolean report = destination.equals("/reports/" + event.reportId() + "/events");
                if (!site && !report) continue;
                try {
                    Long siteId = access.authorize(client.sessionId(), destination);
                    if (!siteId.equals(event.siteId())) { revoke(client, destination); continue; }
                    var payload = new LinkedHashMap<String, Object>();
                    payload.put("eventId", event.eventId().toString()); payload.put("eventType", event.eventType());
                    payload.put("schemaVersion", event.schemaVersion()); payload.put("occurredAt", event.occurredAt().toString());
                    payload.put("siteId", event.siteId()); payload.put("reportId", event.reportId());
                    payload.put("previousStatus", event.previousStatus().name()); payload.put("status", event.status().name());
                    if (report) {
                        payload.put("previousAssigneeId", event.previousAssigneeId());
                        payload.put("assigneeId", event.assigneeId());
                    }
                    client.socket().sendMessage(new TextMessage(json.writeValueAsString(
                            Map.of("type", "event", "destination", destination, "event", payload))));
                } catch (RuntimeException ex) {
                    try { revoke(client, destination); } catch (IOException io) { close(client); }
                } catch (IOException ex) { close(client); }
            }
        }
    }

    @EventListener
    public void sessionEnded(SessionEnded event) {
        clients.values().stream().filter(c -> c.sessionId().equals(event.sessionId())).forEach(this::close);
    }

    @Scheduled(fixedDelayString = "${fixflow.websocket.session-check-ms:5000}")
    public void checkSessions() {
        for (Client client : clients.values()) {
            try {
                access.actor(client.sessionId());
                for (String destination : Set.copyOf(client.subscriptions())) {
                    try { access.authorize(client.sessionId(), destination); }
                    catch (RuntimeException ex) { revoke(client, destination); }
                }
            } catch (IOException | RuntimeException ex) { close(client); }
        }
    }

    private void control(Client client, String type, String destination) throws IOException {
        client.socket().sendMessage(new TextMessage(json.writeValueAsString(
                Map.of("type", type, "destination", destination))));
    }

    private void revoke(Client client, String destination) throws IOException {
        // Scheduler and committed-event delivery may both observe the same lost access.
        if (client.subscriptions().remove(destination)) {
            control(client, "subscription-revoked", destination);
        }
    }

    private void close(Client client) {
        clients.remove(client.socket().getId());
        try { client.socket().close(CloseStatus.POLICY_VIOLATION); } catch (IOException ignored) { }
    }
}
