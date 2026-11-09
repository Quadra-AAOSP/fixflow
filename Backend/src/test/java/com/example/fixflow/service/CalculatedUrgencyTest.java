package com.example.fixflow.service;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.Test;
import com.example.fixflow.domain.Report;
import com.example.fixflow.domain.Urgency;

class CalculatedUrgencyTest {
    @Test void thresholdsRaiseButNeverDowngradeOrCreateCritical() {
        assertThat(ReportService.calculateUrgency(Urgency.low, 2, 3, 5)).isEqualTo(Urgency.low);
        assertThat(ReportService.calculateUrgency(Urgency.low, 3, 3, 5)).isEqualTo(Urgency.medium);
        assertThat(ReportService.calculateUrgency(Urgency.low, 50, 3, 5)).isEqualTo(Urgency.high);
        assertThat(ReportService.calculateUrgency(Urgency.critical, 50, 3, 5)).isEqualTo(Urgency.critical);
        assertThat(ReportService.calculateUrgency(Urgency.low, 3, 4, 8)).isEqualTo(Urgency.low);
    }
    @Test void manualOverrideTakesPrecedence() {
        Report report = new Report();
        report.setReporterUrgency(Urgency.critical);
        report.setCalculatedUrgency(Urgency.high);
        report.setFinalUrgency(Urgency.low);
        assertThat(report.getEffectiveUrgency()).isEqualTo(Urgency.low);
        report.setFinalUrgency(null);
        assertThat(report.getEffectiveUrgency()).isEqualTo(Urgency.high);
    }
}
