package com.example.fixflow.domain;

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

	@Column(nullable = false)
	private int proficiency = 3;
}
