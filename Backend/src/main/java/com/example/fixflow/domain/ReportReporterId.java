package com.example.fixflow.domain;

import java.io.Serializable;
import java.util.Objects;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ReportReporterId implements Serializable {

	private Long reportId;
	private Long userId;

	@Override
	public boolean equals(Object o) {
		if (this == o) {
			return true;
		}
		if (!(o instanceof ReportReporterId other)) {
			return false;
		}
		return Objects.equals(reportId, other.reportId) && Objects.equals(userId, other.userId);
	}

	@Override
	public int hashCode() {
		return Objects.hash(reportId, userId);
	}
}
