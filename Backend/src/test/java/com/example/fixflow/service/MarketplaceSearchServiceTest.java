package com.example.fixflow.service;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import com.example.fixflow.ai.ChatProvider;
import com.example.fixflow.domain.*;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.web.ApiException;
import com.fasterxml.jackson.databind.ObjectMapper;

class MarketplaceSearchServiceTest {
    @Test void uncontractedTechnicianGetsOnlyEligibleResultsWithValidatedFiltersAndFallback() throws Exception {
        var market = mock(MarketplaceService.class);
        var assistant = mock(ReportAssistantService.class);
        @SuppressWarnings("unchecked") ObjectProvider<ChatProvider> providers = mock(ObjectProvider.class);
        var provider = mock(ChatProvider.class);
        var user = new User(); user.setId(7L); user.setRole(UserRole.technician);
        var actor = new AppUserDetails(user); // no site or contract
        var job = new MarketplaceService.ListingView(1L, "Fix pipe", "North", "Today", "plumbing", "pipe", Urgency.high, MarketplaceListing.Status.open, Instant.now(), null, null, false, null, null);
        when(market.list(actor)).thenReturn(List.of(job));
        when(assistant.tryAcquireRateLimit(7L)).thenReturn(true);
        when(providers.getIfAvailable()).thenReturn(provider);
        when(provider.chat(anyList())).thenReturn("{\"category\":\"plumbing\",\"specialty\":\"invented\",\"urgency\":\"high\"}", "not json");
        var service = new MarketplaceSearchService(market, assistant, providers, new ObjectMapper());
        var result = service.search(new MarketplaceSearchService.Request("urgent plumbing"), actor);
        assertThat(result.listings()).containsExactly(job);
        assertThat(result.filters().specialty()).isNull();
        assertThat(result.fallback()).isFalse();
        var fallback = service.search(new MarketplaceSearchService.Request("pipe"), actor);
        assertThat(fallback.fallback()).isTrue();
        assertThat(fallback.listings()).containsExactly(job);
        user.setRole(UserRole.reporter);
        assertThatThrownBy(() -> service.search(new MarketplaceSearchService.Request("pipe"), new AppUserDetails(user))).isInstanceOf(ApiException.class);
        verify(market, times(2)).list(actor);
    }
}

