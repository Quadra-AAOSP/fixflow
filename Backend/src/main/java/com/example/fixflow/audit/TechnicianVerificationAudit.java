package com.example.fixflow.audit;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "technician_verification_audit")
@Getter
@Setter
@NoArgsConstructor
public class TechnicianVerificationAudit {
	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;
	@Column(nullable = false)
	private Long technicianId;
	@Column(nullable = false)
	private Long actorId;
	@Column(nullable = false, length = 16)
	private String status;
	@Column(nullable = false, columnDefinition = "LONGTEXT")
	private String snapshot;
	@Column(nullable = false)
	private Instant createdAt;

	@PrePersist
	void created() {
		createdAt = Instant.now();
	}
}
