package com.example.fixflow.domain;

import java.time.Instant;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "technician_contract_requests", uniqueConstraints =
        @UniqueConstraint(columnNames = {"technician_id", "site_id"}))
@Getter
@Setter
public class TechnicianContractApplication {
    public enum Status { pending, approved, rejected }
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "technician_id", nullable = false)
    private User technician;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "site_id", nullable = false)
    private Site site;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 16)
    private Status status = Status.pending;
    @Column(length = 1000)
    private String note;
    @Column(name = "decision_reason", length = 1000)
    private String decisionReason;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "decided_by_user_id")
    private User decidedBy;
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
    @Column(name = "decided_at")
    private Instant decidedAt;
    @PrePersist void initialize() { createdAt = Instant.now(); }
}
