package com.example.fixflow.domain;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "report_reporters")
@IdClass(ReportReporterId.class)
@Getter
@Setter
@NoArgsConstructor
public class ReportReporter {

	@Id
	@Column(name = "report_id", nullable = false)
	private Long reportId;

	@Id
	@Column(name = "user_id", nullable = false)
	private Long userId;

	@Column(name = "joined_at", nullable = false, updatable = false)
	private Instant joinedAt;

	@PrePersist
	void onCreate() {
		if (joinedAt == null) {
			joinedAt = Instant.now();
		}
	}
}
