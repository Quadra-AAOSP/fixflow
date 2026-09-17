package com.example.fixflow.domain;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "reports")
@Getter
@Setter
@NoArgsConstructor
public class Report {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "site_id", nullable = false)
	private Site site;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "created_by_user_id", nullable = false)
	private User createdBy;

	@Column(nullable = false, columnDefinition = "TEXT")
	private String description;

	@Column(length = 512)
	private String address;

	@Column(nullable = false, length = 128)
	private String category;

	@Column(length = 128)
	private String specialty;

	@Enumerated(EnumType.STRING)
	@Column(name = "ai_urgency", length = 32)
	private Urgency aiUrgency;

	@Enumerated(EnumType.STRING)
	@Column(name = "reporter_urgency", nullable = false, length = 32)
	private Urgency reporterUrgency;

	@Column(name = "reporter_reason", columnDefinition = "TEXT")
	private String reporterReason;

	@Enumerated(EnumType.STRING)
	@Column(name = "final_urgency", length = 32)
	private Urgency finalUrgency;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 64)
	private ReportStatus status = ReportStatus.open;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "assigned_technician_id")
	private User assignedTechnician;

	@Column(nullable = false)
	private boolean editable = true;

	@Column(name = "reopen_count", nullable = false)
	private int reopenCount = 0;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	@PrePersist
	void onCreate() {
		Instant now = Instant.now();
		createdAt = now;
		updatedAt = now;
		if (status == null) {
			status = ReportStatus.open;
		}
	}

	@PreUpdate
	void onUpdate() {
		updatedAt = Instant.now();
	}
}
