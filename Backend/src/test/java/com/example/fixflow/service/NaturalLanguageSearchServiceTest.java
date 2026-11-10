package com.example.fixflow.service;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import com.example.fixflow.ai.ChatProvider;
import com.example.fixflow.domain.*;
import com.example.fixflow.repository.*;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.web.ApiException;
import com.fasterxml.jackson.databind.ObjectMapper;

class NaturalLanguageSearchServiceTest {
    @Test void validatesModelOutputAndRejectsCrossSiteRequests() throws Exception {
        SiteRepository sites = mock(SiteRepository.class);
        SiteRuleRepository rules = mock(SiteRuleRepository.class);
        TechnicianContractRepository contracts = mock(TechnicianContractRepository.class);
        ReportAssistantService assistant = mock(ReportAssistantService.class);
        @SuppressWarnings("unchecked") ObjectProvider<ChatProvider> providers = mock(ObjectProvider.class);
        ChatProvider provider = mock(ChatProvider.class);
        Site site = new Site(); site.setId(1L); site.setType(SiteType.school);
        User user = new User(); user.setId(10L); user.setSite(site); user.setRole(UserRole.reporter);
        var actor = new AppUserDetails(user);
        when(sites.findById(1L)).thenReturn(Optional.of(site));
        when(rules.findBySiteTypeOrderBySortOrderAsc(SiteType.school)).thenReturn(List.of());
        when(assistant.tryAcquireRateLimit(10L)).thenReturn(true);
        when(providers.getIfAvailable()).thenReturn(provider);
        when(provider.chat(anyList())).thenReturn("{\"status\":\"open\",\"category\":\"invented\",\"urgency\":\"extreme\",\"from\":\"bad\"}");
        var service = new NaturalLanguageSearchService(sites, rules, contracts, assistant, providers, new ObjectMapper());
        var result = service.search(new NaturalLanguageSearchService.Request(1L, "open reports"), actor);
        assertThat(result.fallback()).isTrue();
        assertThat(result.filters().text()).isEqualTo("open reports");
        assertThat(result.filters().status()).isNull();
        assertThat(result.filters().category()).isNull();
        assertThat(result.filters().urgency()).isNull();
        assertThat(result.filters().from()).isNull();
        assertThatThrownBy(() -> service.search(new NaturalLanguageSearchService.Request(2L, "reports"), actor))
                .isInstanceOf(ApiException.class);
        verify(provider, times(1)).chat(anyList());
    }
}
