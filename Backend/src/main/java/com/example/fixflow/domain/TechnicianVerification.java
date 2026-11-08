package com.example.fixflow.domain;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
@Entity @Table(name="technician_verifications") @Getter @Setter @NoArgsConstructor
public class TechnicianVerification {
 @Id @Column(name="technician_id") private Long technicianId;
 @Column(nullable=false,length=16) private String status="unverified";
 @Column(length=128) private String phone;
 @Column(length=255) private String email;
 @Column(length=2000) private String trades;
 @Column(length=4000) private String experience;
 @Column(length=4000) private String qualifications;
 private boolean identityChecked;
 private boolean emailChecked;
 private boolean phoneChecked;
 private boolean tradeChecked;
 @Column(length=2000) private String reason;
 private Long reviewedBy;
 private Instant updatedAt;
 @Version private Long version;
 @PrePersist @PreUpdate void updated(){updatedAt=Instant.now();}
}
