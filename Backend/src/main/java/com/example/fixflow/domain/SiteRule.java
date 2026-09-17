package com.example.fixflow.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(
		name = "site_rules",
		uniqueConstraints = @UniqueConstraint(name = "uq_site_rules_type_category", columnNames = { "site_type", "category" })
)
@Getter
@Setter
@NoArgsConstructor
public class SiteRule {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Enumerated(EnumType.STRING)
	@Column(name = "site_type", nullable = false, length = 32)
	private SiteType siteType;

	@Column(nullable = false, length = 128)
	private String category;

	@Column(name = "urgency_weight", nullable = false)
	private Integer urgencyWeight = 0;

	@Column(name = "sort_order", nullable = false)
	private Integer sortOrder = 0;
}
