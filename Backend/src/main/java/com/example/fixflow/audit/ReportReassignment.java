package com.example.fixflow.audit;

import java.time.Instant;

import com.example.fixflow.domain.Report;
import com.example.fixflow.domain.User;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "report_reassignments")
@Getter
@Setter
@NoArgsConstructor
public class ReportReassignment {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "report_id", nullable = false)
	private Report report;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "from_technician_id", nullable = false)
	private User fromTechnician;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "to_technician_id")
	private User toTechnician;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "reassigned_by_user_id", nullable = false)
	private User reassignedBy;

	@Column(columnDefinition = "TEXT")
	private String reason;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	@PrePersist
	void onCreate() {
		createdAt = Instant.now();
	}
}
