package com.example.fixflow.domain;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "marketplace_applications", uniqueConstraints = @UniqueConstraint(
        name = "uq_marketplace_applicant", columnNames = {"listing_id", "technician_id"}))
@Getter
@Setter
public class MarketplaceApplication {
    public enum Status { pending, offered, accepted, declined, withdrawn, rejected, expired, cancelled }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "listing_id", nullable = false)
    private MarketplaceListing listing;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "technician_id", nullable = false)
    private User technician;
    @Column(nullable = false, length = 1000)
    private String note;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Status status = Status.pending;
    private Instant offerExpiresAt;
}
