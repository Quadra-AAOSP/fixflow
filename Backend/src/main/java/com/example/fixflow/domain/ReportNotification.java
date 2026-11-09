package com.example.fixflow.domain;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "report_notifications", indexes =
        @Index(name = "idx_report_notification_inbox", columnList = "recipient_id, id"))
@Getter
@NoArgsConstructor(access = lombok.AccessLevel.PROTECTED)
public class ReportNotification {
    public enum Type { report_edited, report_deleted, work_completed, site_invitation }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "recipient_id", nullable = false)
    private Long recipientId;
    @Column(nullable = false)
    private Long reportId;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private Type type;
    @Column(nullable = false)
    private Instant createdAt;

    public ReportNotification(Long recipientId, Long reportId, Type type, Instant createdAt) {
        this.recipientId = recipientId;
        this.reportId = reportId;
        this.type = type;
        this.createdAt = createdAt;
    }
}
