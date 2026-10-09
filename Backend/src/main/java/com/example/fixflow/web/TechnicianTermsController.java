package com.example.fixflow.web;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.service.TechnicianTermsService;

@RestController
@RequestMapping("/api/technician-terms")
public class TechnicianTermsController {
    public record AcceptRequest(@NotBlank @Size(max = 64) String version) { }
    private final TechnicianTermsService service;
    public TechnicianTermsController(TechnicianTermsService service) { this.service = service; }
    @GetMapping("/me")
    public TechnicianTermsService.Status me(@AuthenticationPrincipal AppUserDetails actor) {
        return service.status(actor.getId(), actor);
    }
    @GetMapping("/{technicianId}")
    public TechnicianTermsService.Status status(@PathVariable Long technicianId, @AuthenticationPrincipal AppUserDetails actor) {
        return service.status(technicianId, actor);
    }
    @PostMapping(value = "/accept", consumes = "application/json")
    public TechnicianTermsService.Status accept(@Valid @RequestBody AcceptRequest request,
            @AuthenticationPrincipal AppUserDetails actor) { return service.accept(request.version(), actor); }
}
