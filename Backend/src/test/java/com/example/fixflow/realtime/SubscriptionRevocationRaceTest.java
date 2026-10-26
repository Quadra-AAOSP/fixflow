package com.example.fixflow.realtime;

import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import java.util.Map;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.TextMessage;
import com.example.fixflow.domain.User;
import com.example.fixflow.domain.ReportStatus;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.web.ApiException;

class SubscriptionRevocationRaceTest {
    @Test void schedulerAndEventDeliveryRevokeEachSubscriptionOnlyOnce() throws Exception {
        RealtimeAccess access = mock(RealtimeAccess.class);
        WebSocketSession socket = mock(WebSocketSession.class);
        User user = new User(); user.setId(1L);
        when(access.actor("session")).thenReturn(new AppUserDetails(user));
        when(access.authorize("session", "/reports/2/events")).thenReturn(1L);
        when(socket.getId()).thenReturn("socket"); when(socket.isOpen()).thenReturn(true);
        when(socket.getAttributes()).thenReturn(Map.of(ReportWebSocketHandler.HTTP_SESSION_ID, "session"));
        var handler = new ReportWebSocketHandler(access);
        handler.afterConnectionEstablished(socket);
        handler.handleTextMessage(socket, new TextMessage("{\"action\":\"subscribe\",\"destination\":\"/reports/2/events\"}"));
        clearInvocations(socket);
        var barrier = new CyclicBarrier(2);
        when(access.authorize("session", "/reports/2/events")).thenAnswer(call -> {
            barrier.await(5, TimeUnit.SECONDS);
            throw new ApiException(403, "Access changed");
        });
        try (var executor = Executors.newFixedThreadPool(2)) {
            var scheduler = executor.submit(handler::checkSessions);
            var publisher = executor.submit(() -> handler.reportCommitted(ReportDomainEvent.of(
                    ReportDomainEvent.REASSIGNMENT, 1L, 2L, ReportStatus.assigned, ReportStatus.assigned, 1L, 3L)));
            scheduler.get(10, TimeUnit.SECONDS); publisher.get(10, TimeUnit.SECONDS);
        }
        verify(socket, times(1)).sendMessage(argThat(message -> message.getPayload().toString().contains("subscription-revoked")));
    }
}
