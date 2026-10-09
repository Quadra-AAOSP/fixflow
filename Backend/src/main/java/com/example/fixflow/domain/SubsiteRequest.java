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
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "subsite_requests")
@Getter
@Setter
@NoArgsConstructor
public class SubsiteRequest {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "site_id", nullable = false)
    private Site site;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "requested_by_user_id", nullable = false)
    private User requestedBy;
    @Column(columnDefinition = "TEXT") private String note;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 16)
    private Status status = Status.pending;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @Column(name = "resolved_at") private Instant resolvedAt;
    public enum Status { pending, resolved }
    @PrePersist void onCreate() { createdAt = Instant.now(); }
}
