package com.example.fixflow.domain;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "marketplace_listings")
@Getter
@Setter
public class MarketplaceListing {
    public enum Status { open, offered, assigned, closed, expired }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "report_id", nullable = false)
    private Report report;
    @Column(nullable = false, length = 300)
    private String summary;
    @Column(nullable = false, length = 160)
    private String broadLocation;
    @Column(nullable = false, length = 160)
    private String timing;
    @Column(nullable = false, length = 128)
    private String category;
    @Column(length = 128)
    private String specialty;
    @Column(name = "amount_minor", nullable = false)
    private long amountMinor;
    @Column(nullable = false, length = 8)
    private String currency = "USD";
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Status status = Status.open;
    @Column(nullable = false)
    private Instant expiresAt;
}
