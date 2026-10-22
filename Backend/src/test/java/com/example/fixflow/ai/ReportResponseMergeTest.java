package com.example.fixflow.ai;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;
import com.example.fixflow.domain.Report;
import com.example.fixflow.domain.ReportStatus;
import com.example.fixflow.domain.Urgency;
import com.example.fixflow.dto.ReportPhotoResponse;
import com.example.fixflow.dto.ReportPolicy;
import com.example.fixflow.dto.ReportResponse;

class ReportResponseMergeTest {
    @Test void photosAndSeparateAiAssessmentCoexistWithoutReplacingHumanFields() {
        Report report = new Report();
        report.setStatus(ReportStatus.open);
        report.setDescription("Human description");
        report.setCategory("plumbing");
        report.setReporterUrgency(Urgency.low);
        report.setAiUrgency(Urgency.high);
        report.setAiCategory("electrical");
        report.setAiDescription("AI assessment");
        report.setAiUrgencyReason("AI reason");
        var photo = new ReportPhotoResponse(1L, "reports/photo", "https://storage.example/photo",
                "image/png", 32, 0, null, "/api/reports/1/photos/1");
        var policy = ReportPolicy.from(report, true, true, true, false, true);

        var admin = ReportResponse.from(report, policy, List.of(photo), true);
        assertThat(admin.photos()).containsExactly(photo);
        assertThat(admin.description()).isEqualTo("Human description");
        assertThat(admin.category()).isEqualTo("plumbing");
        assertThat(admin.reporterUrgency()).isEqualTo(Urgency.low);
        assertThat(admin.aiReport().description()).isEqualTo("AI assessment");
        assertThat(admin.aiReport().urgencyReason()).isEqualTo("AI reason");

        var reporter = ReportResponse.from(report, policy, List.of(photo), false);
        assertThat(reporter.photos()).containsExactly(photo);
        assertThat(reporter.aiReport().urgency()).isEqualTo(Urgency.high);
        assertThat(reporter.aiReport().description()).isNull();
        assertThat(reporter.aiReport().category()).isNull();
        assertThat(reporter.aiReport().urgencyReason()).isNull();
    }
}
