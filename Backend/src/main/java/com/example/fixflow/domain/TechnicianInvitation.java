package com.example.fixflow.domain;

import java.time.Instant;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "technician_invitations", uniqueConstraints = @UniqueConstraint(columnNames = {"report_id", "technician_id"}))
@Getter
@Setter
public class TechnicianInvitation {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "report_id") private Report report;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "technician_id") private User technician;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "invited_by") private User invitedBy;
    @Column(nullable = false, length = 1000) private String reason;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    @PrePersist void created() { createdAt = Instant.now(); }
}
