package com.example.fixflow.domain;

import java.time.Instant;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity @Table(name = "report_vision_jobs") @Getter @Setter
public class ReportVisionJob {
    @Id @Column(length = 36) private String id;
    @Column(name = "report_id", nullable = false) private Long reportId;
    @Lob @Column(name = "image_data", columnDefinition = "LONGBLOB") private byte[] imageData;
    @Column(columnDefinition = "TEXT", nullable = false) private String description;
    @Column(length = 128, nullable = false) private String category;
    @Column(length = 128) private String specialty;
    @Column(name = "ai_urgency", length = 32) private String aiUrgency;
    @Column(length = 32, nullable = false) private String status = "queued";
    @Column(length = 255) private String model;
    @Column(name = "ai_snapshot", length = 64) private String aiSnapshot;
    @Column(nullable = false) private int attempts;
    @Column(name = "created_at", nullable = false) private Instant createdAt = Instant.now();
    @Column(name = "updated_at", nullable = false) private Instant updatedAt = Instant.now();
}
