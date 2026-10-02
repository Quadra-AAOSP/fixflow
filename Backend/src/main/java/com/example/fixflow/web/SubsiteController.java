package com.example.fixflow.web;

import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import jakarta.validation.Valid;
import com.example.fixflow.dto.SubsiteAlertRequest;
import com.example.fixflow.dto.SubsiteAlertResponse;
import com.example.fixflow.dto.SubsiteRequest;
import com.example.fixflow.dto.SubsiteResponse;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.service.SubsiteService;

@RestController
@RequestMapping("/api/sites/{siteId}")
public class SubsiteController {
    private final SubsiteService service;
    public SubsiteController(SubsiteService service) { this.service = service; }
    @GetMapping("/subsites")
    public List<SubsiteResponse> list(@PathVariable Long siteId, @AuthenticationPrincipal AppUserDetails actor) {
        return service.list(siteId, actor);
    }
    @PostMapping(value = "/subsites", consumes = "application/json")
    public ResponseEntity<SubsiteResponse> create(@PathVariable Long siteId,
            @Valid @RequestBody SubsiteRequest request, @AuthenticationPrincipal AppUserDetails actor) {
        return ResponseEntity.status(201).body(service.create(siteId, request, actor));
    }
    @PostMapping(value = "/subsite-requests", consumes = "application/json")
    public ResponseEntity<SubsiteAlertResponse> alert(@PathVariable Long siteId,
            @Valid @RequestBody SubsiteAlertRequest request, @AuthenticationPrincipal AppUserDetails actor) {
        return ResponseEntity.status(201).body(service.requestAddition(siteId, request, actor));
    }
    @GetMapping("/subsite-requests")
    public List<SubsiteAlertResponse> pending(@PathVariable Long siteId, @AuthenticationPrincipal AppUserDetails actor) {
        return service.pending(siteId, actor);
    }
    @PostMapping("/subsite-requests/{id}/resolve")
    public SubsiteAlertResponse resolve(@PathVariable Long siteId, @PathVariable Long id,
            @AuthenticationPrincipal AppUserDetails actor) { return service.resolve(siteId, id, actor); }
}
