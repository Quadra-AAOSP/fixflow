package com.example.fixflow.realtime;

import java.time.Duration;
import java.time.Instant;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.convert.DurationStyle;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.session.Session;
import org.springframework.session.SessionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import com.example.fixflow.repository.UserRepository;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.security.SessionExpiryFilter;
import com.example.fixflow.service.ReportService;
import com.example.fixflow.service.SiteService;
import com.example.fixflow.web.ApiException;

@Service
public class RealtimeAccess {
    public static final Pattern DESTINATION = Pattern.compile("^/(sites|reports)/([1-9][0-9]*)/events$");
    private final SessionRepository<? extends Session> sessions;
    private final UserRepository users;
    private final SiteService sites;
    private final ReportService reports;
    private final Duration absoluteTimeout;

    public RealtimeAccess(SessionRepository<? extends Session> sessions, UserRepository users,
            SiteService sites, ReportService reports,
            @Value("${fixflow.session.absolute-timeout:12h}") String absoluteTimeout) {
        this.sessions = sessions; this.users = users; this.sites = sites; this.reports = reports;
        this.absoluteTimeout = DurationStyle.detectAndParse(absoluteTimeout);
    }

    /** Read only; socket traffic never extends HTTP idle or absolute session lifetime. */
    @Transactional(readOnly = true, propagation = Propagation.REQUIRES_NEW)
    public AppUserDetails actor(String sessionId) {
        Session session = sessionId == null ? null : sessions.findById(sessionId);
        if (session == null || session.isExpired()) throw new ApiException(401, "Session expired");
        Object started = session.getAttribute(SessionExpiryFilter.AUTHENTICATED_AT);
        Instant since = started instanceof Instant time ? time : session.getCreationTime();
        if (!Instant.now().isBefore(since.plus(absoluteTimeout))) throw new ApiException(401, "Session expired");
        Object value = session.getAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY);
        if (!(value instanceof SecurityContext context) || context.getAuthentication() == null
                || !context.getAuthentication().isAuthenticated()
                || !(context.getAuthentication().getPrincipal() instanceof AppUserDetails principal)) {
            throw new ApiException(401, "Authentication required");
        }
        // Reload role/site from DB; an open socket cannot retain old privileges.
        return users.findWithSiteById(principal.getId()).map(AppUserDetails::new)
                .orElseThrow(() -> new ApiException(401, "Account unavailable"));
    }

    /** Returns the authorized site's ID. Reused on subscribe and immediately before delivery. */
    @Transactional(readOnly = true, propagation = Propagation.REQUIRES_NEW)
    public Long authorize(String sessionId, String destination) {
        AppUserDetails actor = actor(sessionId);
        var match = DESTINATION.matcher(destination);
        if (!match.matches()) throw new ApiException(403, "Unknown destination");
        long id;
        try { id = Long.parseLong(match.group(2)); }
        catch (NumberFormatException ex) { throw new ApiException(403, "Invalid destination"); }
        if (match.group(1).equals("sites")) return sites.get(id, actor).id();
        var report = reports.get(id, actor);
        if (!report.policy().canSeeSensitive()) throw new ApiException(403, "Report details unavailable");
        return report.siteId();
    }
}
