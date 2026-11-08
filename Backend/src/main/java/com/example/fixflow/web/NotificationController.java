package com.example.fixflow.web;

import java.time.Instant;
import java.util.List;

import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.example.fixflow.domain.ReportNotification.Type;
import com.example.fixflow.repository.ReportNotificationRepository;
import com.example.fixflow.security.AppUserDetails;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {
    private final ReportNotificationRepository notifications;

    public NotificationController(ReportNotificationRepository notifications) {
        this.notifications = notifications;
    }

    public record Item(Long id, Long reportId, Type type, Instant createdAt) { }
    public record Inbox(List<Item> content, boolean hasMore) { }

    @GetMapping
    public Inbox list(@AuthenticationPrincipal AppUserDetails actor,
            @RequestParam(defaultValue = "0") int page) {
        if (page < 0) {
            throw new ApiException(400, "page must be non-negative");
        }
        var result = notifications.findByRecipientIdOrderByIdDesc(actor.getId(), PageRequest.of(page, 20));
        return new Inbox(result.map(row -> new Item(row.getId(), row.getReportId(),
                row.getType(), row.getCreatedAt())).getContent(), result.hasNext());
    }
}
