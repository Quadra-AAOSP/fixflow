package com.example.fixflow.domain;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Who can see a report beyond its staff/admin audience. `PUBLIC` reports are
 * listed for every reporter at the site (and can be joined); `PRIVATE`
 * reports are visible only to the filing reporter, attached reporters
 * (participants), staff/admin/super_admin, and the assigned technician.
 *
 * JSON and database values are the lowercase forms (`public` / `private`),
 * matching the codebase's lowercase enum convention (`ReportStatus`, …) —
 * the Java constants stay uppercase because `public`/`private` are keywords.
 */
public enum ReportVisibility {
	PUBLIC,
	PRIVATE;

	@JsonValue
	public String json() {
		return name().toLowerCase();
	}

	@JsonCreator
	public static ReportVisibility fromJson(String value) {
		if (value == null) {
			return null;
		}
		return ReportVisibility.valueOf(value.trim().toUpperCase());
	}
}
