package com.example.fixflow.domain;

import java.math.BigDecimal;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(
		name = "technician_skills",
		uniqueConstraints = @UniqueConstraint(
				name = "uq_tech_skill",
				columnNames = { "technician_id", "category", "specialty" }
		)
)
@Getter
@Setter
@NoArgsConstructor
public class TechnicianSkill {

	public static final BigDecimal STARTING_PROFICIENCY = new BigDecimal("2.5");

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "technician_id", nullable = false)
	private User technician;

	@Column(nullable = false, length = 128)
	private String category;

	@Column(length = 128)
	private String specialty;

	/** Platform-managed score from 1.0–5.0; technicians cannot override it. */
	@Column(nullable = false, precision = 3, scale = 1)
	private BigDecimal proficiency = STARTING_PROFICIENCY;
}
