package com.example.fixflow.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import com.example.fixflow.domain.Report;
import com.example.fixflow.domain.ReportStatus;
import com.example.fixflow.domain.Urgency;
import com.example.fixflow.domain.User;
import com.example.fixflow.domain.UserRole;
import com.example.fixflow.dto.ReportPolicy;
import com.example.fixflow.dto.UserCapabilities;
import com.example.fixflow.dto.RegisterRequest;
import com.example.fixflow.service.AccountPolicy;
import com.example.fixflow.web.ApiException;
import org.junit.jupiter.api.Test;

class BackendPolicyTest {
    @Test void passwordAndTechnicianRequirementsAreEnforcedWithoutAFrontend() {
        assertThatThrownBy(() -> AccountPolicy.validatePassword("password123"))
                .isInstanceOf(ApiException.class);
        AccountPolicy.validatePassword("password12345678");
        assertThatThrownBy(() -> AccountPolicy.validatePassword("😀".repeat(19)))
                .isInstanceOf(ApiException.class).hasMessageContaining("72");
        assertThatThrownBy(() -> AccountPolicy.validateRegistration(new RegisterRequest(
                "tech@example.test", "password12345678", "Test", "Tech", null, null,
                UserRole.technician, null))).isInstanceOf(ApiException.class);
        AccountPolicy.validateRegistration(new RegisterRequest("tech@example.test",
                "password12345678", "Test", "Tech", "123456789", "Test address", UserRole.technician, null));
    }

    @Test void capabilityHintsMatchBackendRoles() {
        assertThat(UserCapabilities.forRole(UserRole.admin).provisionableRoles()).containsExactly(UserRole.staff);
        assertThat(UserCapabilities.forRole(UserRole.super_admin).provisionableRoles())
                .containsExactly(UserRole.staff, UserRole.admin, UserRole.shop_manager);
        assertThat(UserCapabilities.forRole(UserRole.shop_manager).manageShop()).isTrue();
        assertThat(UserCapabilities.forRole(UserRole.shop_manager).provision()).isFalse();
        assertThat(UserCapabilities.forRole(UserRole.admin).manageShop()).isFalse();
        assertThat(UserCapabilities.forRole(UserRole.reporter).assignTechnician()).isFalse();
        assertThat(UserCapabilities.forRole(UserRole.technician).createReport()).isFalse();
    }

    @Test void reportPolicySeparatesParticipationFromSensitiveAccessAndPreservesQueueRules() {
        Report report = new Report(); report.setReporterUrgency(Urgency.high);
        report.setStatus(ReportStatus.assigned); report.setAssignedTechnician(new User());
        var policy = ReportPolicy.from(report, true, false, true, false, true);
        assertThat(policy.participant()).isFalse(); assertThat(policy.canSeeSensitive()).isTrue();
        assertThat(policy.inAssignmentQueue()).isTrue(); assertThat(policy.urgent()).isTrue();
        report.setFinalUrgency(Urgency.low);
        assertThat(ReportPolicy.from(report, true, false, true, false, true).urgent()).isFalse();
        report.setStatus(ReportStatus.resolved_pending_confirmation);
        assertThat(ReportPolicy.from(report, true, false, true, false, true).inAssignmentQueue()).isFalse();
        assertThat(ReportPolicy.from(report, true, false, true, false, true).statusGroup()).isEqualTo("resolved");
    }
}
