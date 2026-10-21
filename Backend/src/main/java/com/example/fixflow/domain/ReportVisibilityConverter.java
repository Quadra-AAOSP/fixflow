package com.example.fixflow.domain;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * Stores `ReportVisibility` as its lowercase contract value (`public` /
 * `private`) in the `reports.visibility` VARCHAR column, consistent with the
 * schema's lowercase status values elsewhere.
 */
@Converter
public class ReportVisibilityConverter
		implements AttributeConverter<ReportVisibility, String> {

	@Override
	public String convertToDatabaseColumn(ReportVisibility attribute) {
		return attribute == null ? null : attribute.name().toLowerCase();
	}

	@Override
	public ReportVisibility convertToEntityAttribute(String dbData) {
		return dbData == null ? null : ReportVisibility.valueOf(dbData.toUpperCase());
	}
}
