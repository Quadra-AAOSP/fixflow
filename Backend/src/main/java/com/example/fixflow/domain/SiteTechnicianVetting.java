package com.example.fixflow.domain;
import java.time.Instant;
import jakarta.persistence.*;
import lombok.*;
@Entity @Table(name="site_technician_vetting") @Getter @Setter @NoArgsConstructor
public class SiteTechnicianVetting {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @Column(nullable=false) private Long siteId;
 @Column(nullable=false) private Long technicianId;
 @Column(nullable=false,length=16) private String status;
 @Column(nullable=false) private Long reviewedBy;
 @Column(nullable=false) private Instant reviewedAt;
 private Instant expiresAt;
 @Column(nullable=false) private boolean identityChecked;
 @Column(nullable=false) private boolean referencesChecked;
 @Column(nullable=false) private boolean qualificationsChecked;
 @Column(nullable=false) private boolean licenceApplicable;
 @Column(nullable=false) private boolean licenceChecked;
 private Instant licenceExpiresAt;
 @Column(nullable=false) private boolean insuranceApplicable;
 @Column(nullable=false) private boolean insuranceChecked;
 private Instant insuranceExpiresAt;
}
