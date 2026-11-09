package com.example.fixflow.domain;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "marketplace_audit")
public class MarketplaceAudit {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false)
    private Long listingId;
    private Long applicationId;
    private Long actorId;
    @Column(nullable = false, length = 32)
    private String action;
    @Column(nullable = false)
    private Instant occurredAt;

    protected MarketplaceAudit() { }

    public MarketplaceAudit(Long listingId, Long applicationId, Long actorId, String action, Instant occurredAt) {
        this.listingId = listingId;
        this.applicationId = applicationId;
        this.actorId = actorId;
        this.action = action;
        this.occurredAt = occurredAt;
    }
}
