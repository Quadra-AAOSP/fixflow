package com.example.fixflow.domain;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
@Entity @Table(name="report_links",uniqueConstraints=@UniqueConstraint(columnNames={"report_id","linked_report_id"}))
@Getter @Setter @NoArgsConstructor
public class ReportLink {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="report_id",nullable=false) private Report report;
 @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="linked_report_id",nullable=false) private Report linkedReport;
 @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="created_by_id",nullable=false) private User createdBy;
 @Column(nullable=false,length=2000) private String reason;
 @Column(name="created_at",nullable=false,updatable=false) private Instant createdAt;
 @PrePersist void created(){createdAt=Instant.now();}
}
