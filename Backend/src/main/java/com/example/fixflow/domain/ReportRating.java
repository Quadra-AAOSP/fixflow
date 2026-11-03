package com.example.fixflow.domain;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
@Entity @Table(name="report_ratings",uniqueConstraints=@UniqueConstraint(columnNames={"resolution_id","rated_by_id"}))
@Getter @Setter @NoArgsConstructor
public class ReportRating {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="resolution_id",nullable=false) private ReportResolution resolution;
 @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="rated_by_id",nullable=false) private User ratedBy;
 @Column(nullable=false) private int score;
 @Column(length=2000) private String feedback;
 @Column(name="created_at",nullable=false,updatable=false) private Instant createdAt;
 @PrePersist void created(){createdAt=Instant.now();}
}
