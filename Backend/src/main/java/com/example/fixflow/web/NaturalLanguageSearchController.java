package com.example.fixflow.web;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.service.NaturalLanguageSearchService;

@RestController
public class NaturalLanguageSearchController {
    private final NaturalLanguageSearchService service;
    public NaturalLanguageSearchController(NaturalLanguageSearchService service) { this.service = service; }
    @PostMapping("/api/reports/search/nl")
    public NaturalLanguageSearchService.Result search(@RequestBody NaturalLanguageSearchService.Request request,
            @AuthenticationPrincipal AppUserDetails actor) { return service.search(request, actor); }
}
