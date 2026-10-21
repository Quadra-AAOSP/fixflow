package com.example.fixflow.realtime;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.session.Session;
import org.springframework.session.SessionRepository;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import com.example.fixflow.domain.*;
import com.example.fixflow.dto.AssignTechnicianRequest;
import com.example.fixflow.repository.*;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.security.SessionExpiryFilter;
import com.example.fixflow.service.ReportService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.datasource.url=jdbc:h2:mem:socket-api;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE",
        "server.servlet.session.cookie.secure=false", "spring.session.timeout=60s",
        "fixflow.websocket.allowed-origins=http://localhost:5173",
        "fixflow.websocket.session-check-ms=100", "openrouter.vision.enabled=false"
})
class ReportWebSocketIntegrationTest {
    @LocalServerPort int port;
    @Autowired SiteRepository sites;
    @Autowired UserRepository users;
    @Autowired ReportRepository reports;
    @Autowired TechnicianContractRepository contracts;
    @Autowired ReportReporterRepository reporters;
    @Autowired PasswordEncoder encoder;
    @Autowired ReportService service;
    @Autowired PlatformTransactionManager transactions;
    @Autowired org.springframework.context.ApplicationEventPublisher events;
    @Autowired @SuppressWarnings("rawtypes") SessionRepository sessions;
    @MockitoSpyBean ReportWebSocketHandler handler;
    private final ObjectMapper json = new ObjectMapper();
    private final HttpClient http = HttpClient.newHttpClient();
    private final List<Connection> connections = new ArrayList<>();
    private Site site;
    private Site foreign;
    private User admin;
    private User owner;
    private User technician;
    private Report report;

    @BeforeEach void setup() {
        site = site("Socket campus"); foreign = site("Foreign campus");
        admin = account(UserRole.admin, site); owner = account(UserRole.reporter, site);
        technician = account(UserRole.technician, null);
        contract(technician);
        report = report(site, owner);
    }
    @AfterEach void cleanup() { connections.forEach(c -> c.socket.abort()); }
    private void contract(User technician) {
        TechnicianContract contract = new TechnicianContract();
        contract.setTechnician(technician); contract.setSite(site); contracts.save(contract);
    }
    private Site site(String name) {
        Site s = new Site(); s.setName(name); s.setType(SiteType.school);
        s.setContractStatus(ContractStatus.contracted); return sites.save(s);
    }
    private User account(UserRole role, Site scope) {
        User u = new User(); u.setEmail("socket-" + UUID.randomUUID() + "@example.test");
        u.setFirstName("Socket"); u.setLastName("User"); u.setPasswordHash(encoder.encode("socket-test-password"));
        u.setRole(role); u.setSite(scope); return users.save(u);
    }
    private Report report(Site scope, User creator) {
        Report r = new Report(); r.setSite(scope); r.setCreatedBy(creator);
        r.setDescription("PRIVATE description"); r.setAddress("PRIVATE room");
        r.setCategory("plumbing"); r.setReporterUrgency(Urgency.high); r = reports.save(r);
        ReportReporter member = new ReportReporter(); member.setReportId(r.getId()); member.setUserId(creator.getId());
        reporters.save(member); return r;
    }
    private String url(String path) { return "http://localhost:" + port + path; }
    private String cookie(User user) throws Exception {
        var response = http.send(HttpRequest.newBuilder(URI.create(url("/api/auth/login")))
                .header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString(
                        json.writeValueAsString(Map.of("email", user.getEmail(), "password", "socket-test-password"))))
                .build(), HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).isEqualTo(200);
        return response.headers().allValues("set-cookie").stream().filter(c -> c.startsWith("SESSION="))
                .findFirst().orElseThrow().split(";", 2)[0];
    }
    private String sessionId(String cookie) {
        return new String(Base64.getDecoder().decode(cookie.substring("SESSION=".length())),
                java.nio.charset.StandardCharsets.UTF_8);
    }
    private CompletableFuture<WebSocket> handshake(String cookie, String origin, Inbox inbox) {
        var builder = http.newWebSocketBuilder().connectTimeout(Duration.ofSeconds(3));
        if (cookie != null) builder.header("Cookie", cookie);
        if (origin != null) builder.header("Origin", origin);
        return builder.buildAsync(URI.create("ws://localhost:" + port + "/ws/reports"), inbox);
    }
    private Connection connect(String cookie) throws Exception {
        Inbox inbox = new Inbox();
        Connection c = new Connection(handshake(cookie, "http://localhost:5173", inbox).get(5, TimeUnit.SECONDS), inbox);
        connections.add(c); return c;
    }
    private Connection connect(User user) throws Exception { return connect(cookie(user)); }
    private String siteDestination(Site s) { return "/sites/" + s.getId() + "/events"; }
    private String reportDestination(Report r) { return "/reports/" + r.getId() + "/events"; }
    private JsonNode next(Connection c) throws Exception {
        String message = c.inbox.messages.poll(5, TimeUnit.SECONDS);
        assertThat(message).as("Expected WebSocket message").isNotNull(); return json.readTree(message);
    }
    private void subscribe(Connection c, String destination) throws Exception {
        c.socket.sendText(json.writeValueAsString(Map.of("action", "subscribe", "destination", destination)), true).join();
        assertThat(next(c).path("type").asText()).isEqualTo("subscribed");
    }
    private void rejectedHandshake(String cookie, String origin, int status) throws Exception {
        try {
            WebSocket socket = handshake(cookie, origin, new Inbox()).get(5, TimeUnit.SECONDS);
            socket.abort(); fail("Handshake should be rejected");
        } catch (ExecutionException rejected) {
            assertThat(rejected.getCause()).isInstanceOf(WebSocketHandshakeException.class);
            assertThat(((WebSocketHandshakeException) rejected.getCause()).getResponse().statusCode()).isEqualTo(status);
        }
    }

    @Test void assignmentDeliversOnlyToAuthorizedRecipientsAndMasksSiteSummaries() throws Exception {
        Connection summary = connect(owner); subscribe(summary, siteDestination(site));
        Connection details = connect(admin); subscribe(details, reportDestination(report));
        Connection unrelated = connect(account(UserRole.admin, foreign)); subscribe(unrelated, siteDestination(foreign));
        service.assign(report.getId(), new AssignTechnicianRequest(technician.getId()), new AppUserDetails(admin));
        Set<String> types = new HashSet<>();
        for (int i = 0; i < 2; i++) {
            var event = next(summary).path("event"); types.add(event.path("eventType").asText());
            assertThat(event.has("eventId")).isTrue(); assertThat(event.path("schemaVersion").asInt()).isEqualTo(1);
            assertThat(event.has("assigneeId")).isFalse();
            assertThat(event.toString()).doesNotContain("PRIVATE", owner.getEmail(), "description", "address");
            assertThat(next(details).path("event").path("assigneeId").asLong()).isEqualTo(technician.getId());
        }
        assertThat(types).containsExactlyInAnyOrder(ReportDomainEvent.ASSIGNMENT, ReportDomainEvent.STATUS_CHANGE);
        assertThat(unrelated.inbox.messages.poll(250, TimeUnit.MILLISECONDS)).isNull();
        service.assign(report.getId(), new AssignTechnicianRequest(technician.getId()), new AppUserDetails(admin));
        assertThat(summary.inbox.messages.poll(250, TimeUnit.MILLISECONDS)).isNull();
    }

    @Test void rollbackSuppressesEventsAndRestoresOriginalAssignment() throws Exception {
        Connection client = connect(admin); subscribe(client, reportDestination(report));
        new TransactionTemplate(transactions).executeWithoutResult(tx -> {
            service.assign(report.getId(), new AssignTechnicianRequest(technician.getId()), new AppUserDetails(admin));
            tx.setRollbackOnly();
        });
        assertThat(client.inbox.messages.poll(400, TimeUnit.MILLISECONDS)).isNull();
        assertThat(reports.findById(report.getId()).orElseThrow().getAssignedTechnician()).isNull();
        events.publishEvent(ReportDomainEvent.of(ReportDomainEvent.STATUS_CHANGE, site.getId(), report.getId(),
                ReportStatus.open, ReportStatus.assigned, null, technician.getId()));
        assertThat(client.inbox.messages.poll(250, TimeUnit.MILLISECONDS)).isNull();
    }

    @Test void consumesCommittedLifecycleFactsWithoutImplementingDomainTransitions() throws Exception {
        Connection client = connect(admin); subscribe(client, reportDestination(report));
        for (var fact : List.of(Map.entry(ReportDomainEvent.STATUS_CHANGE, ReportStatus.in_progress),
                Map.entry(ReportDomainEvent.PENDING_RESOLUTION, ReportStatus.resolved_pending_confirmation),
                Map.entry(ReportDomainEvent.CONFIRMATION, ReportStatus.confirmed))) {
            new TransactionTemplate(transactions).executeWithoutResult(tx -> {
                Report current = reports.findById(report.getId()).orElseThrow();
                ReportStatus previous = current.getStatus(); current.setStatus(fact.getValue());
                events.publishEvent(ReportDomainEvent.of(fact.getKey(), site.getId(), report.getId(),
                        previous, fact.getValue(), null, null));
            });
            var message = next(client).path("event");
            assertThat(message.path("eventType").asText()).isEqualTo(fact.getKey());
            assertThat(message.path("status").asText()).isEqualTo(fact.getValue().name());
        }
    }

    @Test void attachedReporterAndSuperAdminCanSubscribeAndRoleLossRevokesDetails() throws Exception {
        Connection ownerClient = connect(owner); subscribe(ownerClient, reportDestination(report));
        Connection superClient = connect(account(UserRole.super_admin, null));
        subscribe(superClient, siteDestination(foreign)); subscribe(superClient, reportDestination(report));
        Connection administrator = connect(admin); subscribe(administrator, reportDestination(report));
        admin.setRole(UserRole.reporter); users.save(admin);
        assertThat(next(administrator).path("type").asText()).isEqualTo("subscription-revoked");
    }

    @Test void missingExpiredSessionsAndUnapprovedOriginsCannotConnect() throws Exception {
        rejectedHandshake(null, "http://localhost:5173", 401);
        String cookie = cookie(admin);
        rejectedHandshake(cookie, "https://untrusted.example", 403);
        rejectedHandshake(cookie, null, 403);
        Session session = sessions.findById(sessionId(cookie));
        session.setLastAccessedTime(Instant.now().minusSeconds(120)); sessions.save(session);
        rejectedHandshake(cookie, "http://localhost:5173", 401);
    }

    @Test void wrongRoleForeignSiteChangedReportAndForgedPublicationAreRejected() throws Exception {
        for (var attempt : List.of(
                Map.entry(account(UserRole.shop_manager, null), siteDestination(site)),
                Map.entry(admin, siteDestination(foreign)),
                Map.entry(account(UserRole.reporter, site), reportDestination(report)),
                Map.entry(admin, reportDestination(report(foreign, account(UserRole.reporter, foreign)))))) {
            Connection client = connect(attempt.getKey());
            client.socket.sendText(json.writeValueAsString(Map.of("action", "subscribe", "destination", attempt.getValue())), true).join();
            assertThat(client.inbox.closed.get(5, TimeUnit.SECONDS)).isEqualTo(1008);
        }
        for (String forged : List.of("{\"action\":\"SEND\",\"destination\":\"" + siteDestination(site) + "\"}",
                "SEND\ndestination:" + siteDestination(site) + "\n\nforged\u0000")) {
            Connection client = connect(admin); client.socket.sendText(forged, true).join();
            assertThat(client.inbox.closed.get(5, TimeUnit.SECONDS)).isEqualTo(1008);
        }
    }

    @Test void logoutPublishesSignalAndIdleAndAbsoluteExpiryDisconnectRealSockets() throws Exception {
        String cookie = cookie(admin); Connection client = connect(cookie);
        var response = http.send(HttpRequest.newBuilder(URI.create(url("/api/auth/logout")))
                .header("Cookie", cookie).POST(HttpRequest.BodyPublishers.noBody()).build(), HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).isEqualTo(204);
        verify(handler, timeout(3000)).sessionEnded(argThat(e -> e.sessionId().equals(sessionId(cookie))));
        assertThat(client.inbox.closed.get(5, TimeUnit.SECONDS)).isEqualTo(1008);
        for (boolean absolute : List.of(false, true)) {
            String expiringCookie = cookie(admin); Connection expiring = connect(expiringCookie);
            Session session = sessions.findById(sessionId(expiringCookie));
            if (absolute) session.setAttribute(SessionExpiryFilter.AUTHENTICATED_AT, Instant.now().minus(Duration.ofHours(13)));
            else session.setLastAccessedTime(Instant.now().minusSeconds(120));
            sessions.save(session);
            assertThat(expiring.inbox.closed.get(5, TimeUnit.SECONDS)).isEqualTo(1008);
        }
    }

    @Test void reassignmentRevokesFormerAssigneeAndAllowsNewAssignee() throws Exception {
        service.assign(report.getId(), new AssignTechnicianRequest(technician.getId()), new AppUserDetails(admin));
        Connection former = connect(technician); subscribe(former, reportDestination(report));
        Connection observer = connect(admin); subscribe(observer, reportDestination(report));
        User replacement = account(UserRole.technician, null);
        contract(replacement);
        service.assign(report.getId(), new AssignTechnicianRequest(replacement.getId()), new AppUserDetails(admin));
        var reassigned = next(observer).path("event");
        assertThat(reassigned.path("eventType").asText()).isEqualTo(ReportDomainEvent.REASSIGNMENT);
        assertThat(reassigned.path("previousAssigneeId").asLong()).isEqualTo(technician.getId());
        assertThat(reassigned.path("assigneeId").asLong()).isEqualTo(replacement.getId());
        assertThat(next(former).path("type").asText()).isEqualTo("subscription-revoked");
        assertThat(former.inbox.messages.poll(250, TimeUnit.MILLISECONDS)).isNull();
        Connection current = connect(replacement); subscribe(current, reportDestination(report));
        former.socket.sendText(json.writeValueAsString(Map.of("action", "subscribe", "destination", reportDestination(report))), true).join();
        assertThat(former.inbox.closed.get(5, TimeUnit.SECONDS)).isEqualTo(1008);
    }

    private record Connection(WebSocket socket, Inbox inbox) { }
    private static class Inbox implements WebSocket.Listener {
        final BlockingQueue<String> messages = new LinkedBlockingQueue<>();
        final CompletableFuture<Integer> closed = new CompletableFuture<>();
        final StringBuilder fragment = new StringBuilder();
        @Override public void onOpen(WebSocket socket) { socket.request(1); }
        @Override public CompletionStage<?> onText(WebSocket socket, CharSequence text, boolean last) {
            fragment.append(text);
            if (last) { messages.add(fragment.toString()); fragment.setLength(0); }
            socket.request(1); return null;
        }
        @Override public CompletionStage<?> onClose(WebSocket socket, int code, String reason) {
            closed.complete(code); return null;
        }
        @Override public void onError(WebSocket socket, Throwable error) { closed.completeExceptionally(error); }
    }
}
