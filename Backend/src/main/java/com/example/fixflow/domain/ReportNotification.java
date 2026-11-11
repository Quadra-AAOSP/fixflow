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

/**
 * One inbox row. Rows are recipient-scoped: the same business event fans out to
 * several technicians / admins, each getting their own row.
 *
 * <p>{@code reportId} is set for notices that point at a report and is null for
 * account-level notices (verification, terms, contracts, marketplace jobs).
 * {@code referenceId} carries the secondary id a notice needs to deep-link
 * (listing id, contract application id, technician id).</p>
 */
@Entity
@Table(name = "report_notifications", indexes =
        @Index(name = "idx_report_notification_inbox", columnList = "recipient_id, id"))
@Getter
@NoArgsConstructor(access = lombok.AccessLevel.PROTECTED)
public class ReportNotification {
    public enum Type {
        report_edited,
        report_deleted,
        work_completed,
        site_invitation,
        report_assigned,
        technician_assigned,
        verification_submitted,
        verification_verified,
        verification_rejected,
        verification_suspended,
        terms_required,
        contract_submitted,
        contract_approved,
        contract_rejected,
        job_posted,
        vetting_approved,
        vetting_revoked,
        /**
         * A super administrator noticed a report that nobody has picked up and
         * asked the site's administrators to look at it.
         */
        report_unattended
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "recipient_id", nullable = false)
    private Long recipientId;
    @Column(nullable = true)
    private Long reportId;
    @Column(name = "reference_id", nullable = true)
    private Long referenceId;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private Type type;
    @Column(nullable = false)
    private Instant createdAt;

    public ReportNotification(Long recipientId, Long reportId, Type type, Instant createdAt) {
        this(recipientId, reportId, null, type, createdAt);
    }

    public ReportNotification(Long recipientId, Long reportId, Long referenceId, Type type, Instant createdAt) {
        this.recipientId = recipientId;
        this.reportId = reportId;
        this.referenceId = referenceId;
        this.type = type;
        this.createdAt = createdAt;
    }
}
