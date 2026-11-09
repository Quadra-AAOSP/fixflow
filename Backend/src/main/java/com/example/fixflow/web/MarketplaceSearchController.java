package com.example.fixflow.web;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.service.MarketplaceSearchService;

@RestController
public class MarketplaceSearchController {
    private final MarketplaceSearchService service;
    public MarketplaceSearchController(MarketplaceSearchService service) { this.service = service; }
    @PostMapping("/api/marketplace/search/nl")
    public MarketplaceSearchService.Result search(@RequestBody MarketplaceSearchService.Request request, @AuthenticationPrincipal AppUserDetails actor) {
        return service.search(request, actor);
    }
}
