package com.example.fixflow.web;

import java.util.List;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.service.SiteAdminApplicationService;

@RestController
public class SiteAdminApplicationController {
    private final SiteAdminApplicationService service;
    public SiteAdminApplicationController(SiteAdminApplicationService service) { this.service = service; }
    @GetMapping("/api/auth/site-admin-application")
    public SiteAdminApplicationService.Response mine(@AuthenticationPrincipal AppUserDetails actor) {
        return service.mine(actor);
    }
    @GetMapping("/api/admin/site-admin-applications")
    public List<SiteAdminApplicationService.Response> pending(@AuthenticationPrincipal AppUserDetails actor) {
        return service.pending(actor);
    }
    @PostMapping("/api/admin/site-admin-applications/{id}/approve")
    public SiteAdminApplicationService.Response approve(@PathVariable Long id,
            @AuthenticationPrincipal AppUserDetails actor) { return service.decide(id, true, actor); }
    @PostMapping("/api/admin/site-admin-applications/{id}/reject")
    public SiteAdminApplicationService.Response reject(@PathVariable Long id,
            @AuthenticationPrincipal AppUserDetails actor) { return service.decide(id, false, actor); }
}
