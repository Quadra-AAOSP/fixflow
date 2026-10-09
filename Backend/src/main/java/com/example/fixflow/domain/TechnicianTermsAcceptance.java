package com.example.fixflow.domain;

import java.time.Instant;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
@Table(name = "technician_terms_acceptances", uniqueConstraints =
        @UniqueConstraint(columnNames = {"technician_id", "terms_version"}))
@Getter
@Setter
public class TechnicianTermsAcceptance {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "technician_id", nullable = false) private User technician;
    @Column(name = "terms_version", nullable = false, length = 64) private String termsVersion;
    @Column(name = "document_url", nullable = false, length = 1024) private String documentUrl;
    @Column(name = "accepted_at", nullable = false, updatable = false) private Instant acceptedAt;
    @PrePersist void initialize() { acceptedAt = Instant.now(); }
}
