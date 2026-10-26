package com.example.fixflow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import com.example.fixflow.ai.TechnicianRankingProvider;
import com.example.fixflow.ai.AIProviderException;
import com.example.fixflow.service.TechnicianRankingService;
import com.example.fixflow.repository.TechnicianRankingAuditRepository;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.domain.AvailabilityStatus;
import java.util.List;

class AiTechnicianRankingIntegrationTest extends TechnicianRankingIntegrationTest {
    @MockitoBean TechnicianRankingProvider provider;
    @Autowired TechnicianRankingService rankingService;
    @Autowired TechnicianRankingAuditRepository audits;

    private void secondCandidate() { contract(outsider, site); available(outsider); }
    private TechnicianRankingService.Result rank() {
        return rankingService.rank(report.getId(), TechnicianRankingService.Mode.AI, new AppUserDetails(admin));
    }

    @Test void realAiOrderUsesTemporarySlotsAndIsAudited() throws Exception {
        secondCandidate();
        when(provider.rank(anyString(), nullable(String.class), anyList())).thenAnswer(call -> {
            List<TechnicianRankingProvider.Candidate> candidates = call.getArgument(2);
            assertThat(candidates).extracting(TechnicianRankingProvider.Candidate::slot).containsExactly(0, 1);
            return List.of(1, 0);
        });
        var result = rank();
        assertThat(result.methodUsed()).isEqualTo(TechnicianRankingService.Mode.AI);
        assertThat(result.candidates().getFirst().technicianId()).isEqualTo(outsider.getId());
        assertThat(audits.findAll()).anySatisfy(audit -> {
            assertThat(audit.getReportId()).isEqualTo(report.getId());
            assertThat(audit.getMethodUsed()).isEqualTo("AI");
            assertThat(audit.getActorId()).isEqualTo(admin.getId());
        });
    }

    @Test void manipulatedCandidatesAndProviderErrorsFallBack() throws Exception {
        secondCandidate();
        for (var order : List.of(List.of(0, 0), List.of(0, 999), List.of(0))) {
            when(provider.rank(anyString(), nullable(String.class), anyList())).thenReturn(order);
            assertThat(rank().methodUsed()).isEqualTo(TechnicianRankingService.Mode.STANDARD);
        }
        when(provider.rank(anyString(), nullable(String.class), anyList())).thenThrow(
                new AIProviderException("failure", AIProviderException.AIErrorType.TIMEOUT));
        assertThat(rank().fallbackReason()).contains("provider failed");
    }

    @Test void changedAvailabilityIsRevalidatedAfterProviderResponse() throws Exception {
        secondCandidate();
        when(provider.rank(anyString(), nullable(String.class), anyList())).thenAnswer(call -> {
            var row = availability.findById(outsider.getId()).orElseThrow();
            row.setStatus(AvailabilityStatus.unavailable); availability.saveAndFlush(row);
            return List.of(1, 0);
        });
        var result = rank();
        assertThat(result.methodUsed()).isEqualTo(TechnicianRankingService.Mode.STANDARD);
        assertThat(result.fallbackReason()).contains("changed");
        assertThat(result.candidates()).extracting(TechnicianRankingService.Candidate::technicianId)
                .doesNotContain(outsider.getId());
    }

    @Test void foreignSiteAndWrongRoleAreRejectedBeforeProviderCall() {
        secondCandidate();
        for (var actor : List.of(reporter, userAccount(com.example.fixflow.domain.UserRole.admin, other))) {
            org.junit.jupiter.api.Assertions.assertThrows(com.example.fixflow.web.ApiException.class,
                    () -> rankingService.rank(report.getId(), TechnicianRankingService.Mode.AI, new AppUserDetails(actor)));
        }
        verifyNoInteractions(provider);
    }
}
