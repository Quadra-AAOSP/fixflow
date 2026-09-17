package com.example.fixflow.domain;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapsId;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "technician_availability")
@Getter
@Setter
@NoArgsConstructor
public class TechnicianAvailability {

	@Id
	@Column(name = "technician_id")
	private Long technicianId;

	@OneToOne(fetch = FetchType.LAZY, optional = false)
	@MapsId
	@JoinColumn(name = "technician_id")
	private User technician;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 32)
	private AvailabilityStatus status = AvailabilityStatus.unavailable;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	@PrePersist
	@PreUpdate
	void touch() {
		updatedAt = Instant.now();
		if (status == null) {
			status = AvailabilityStatus.unavailable;
		}
	}
}
