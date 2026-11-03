package com.example.fixflow.domain;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
@Entity @Table(name="report_resolutions")
@Getter @Setter @NoArgsConstructor
public class ReportResolution {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="report_id",nullable=false) private Report report;
 @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="technician_id",nullable=false) private User technician;
 @Column(nullable=false,length=10000) private String description;
 @Column(name="created_at",nullable=false,updatable=false) private Instant createdAt;
 @PrePersist void created(){createdAt=Instant.now();}
}
