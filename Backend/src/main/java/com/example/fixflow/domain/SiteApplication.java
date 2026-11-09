package com.example.fixflow.domain;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
@Entity @Table(name="site_applications") @Getter @Setter @NoArgsConstructor
public class SiteApplication {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @Column(nullable=false,unique=true,length=64) private String trackingHash;
 @Column(nullable=false,length=255) private String organization;
 @Column(nullable=false,length=255) private String siteName;
 @Enumerated(EnumType.STRING) @Column(nullable=false,length=32) private SiteType siteType;
 @Column(nullable=false,length=512) private String address;
 @Column(nullable=false,length=255) private String contactEmail;
 @Column(nullable=false,length=64) private String contactPhone;
 @Column(nullable=false,length=1000) private String relationship;
 @Column(nullable=false,length=128) private String adminFirstName;
 @Column(nullable=false,length=128) private String adminLastName;
 @Column(nullable=false,length=255) private String adminEmail;
 @Column(nullable=false,length=64) private String adminPhone;
 @Column(nullable=false,length=32) private String status="pending";
 @Column(length=2000) private String reviewMessage;
 private Long reviewedBy;
 private Long siteId;
 private Long adminId;
 @Column(unique=true,length=64) private String setupHash;
 private Instant setupExpiresAt;
 private Instant setupUsedAt;
 @Column(nullable=false) private Instant createdAt;
 private Instant reviewedAt;
 @PrePersist void created(){createdAt=Instant.now();}
}
