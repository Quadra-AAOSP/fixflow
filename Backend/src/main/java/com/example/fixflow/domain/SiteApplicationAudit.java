package com.example.fixflow.domain;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
@Entity @Table(name="site_application_audit") @Getter @Setter @NoArgsConstructor
public class SiteApplicationAudit {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @Column(nullable=false) private Long applicationId;
 @Column(nullable=false,length=32) private String action;
 private Long actorId;
 @Column(nullable=false,columnDefinition="TEXT") private String snapshot;
 @Column(nullable=false) private Instant createdAt;
 @PrePersist void created(){createdAt=Instant.now();}
}
