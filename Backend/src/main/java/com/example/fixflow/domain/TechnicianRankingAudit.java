package com.example.fixflow.domain;

import java.time.Instant;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity @Table(name = "technician_ranking_audits") @Getter @Setter
public class TechnicianRankingAudit {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(nullable = false) private Long reportId;
    @Column(nullable = false) private Long actorId;
    @Column(nullable = false, length = 16) private String requestedMode;
    @Column(nullable = false, length = 16) private String methodUsed;
    @Column(length = 255) private String fallbackReason;
    @Column(nullable = false, columnDefinition = "LONGTEXT") private String technicianOrder;
    @Column(nullable = false) private Instant createdAt;
}
