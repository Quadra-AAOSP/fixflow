package com.example.fixflow.web;

import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.service.TechnicianInvitationService;

@RestController
public class TechnicianInvitationController {
    public record Request(@NotBlank @Size(max = 1000) String reason) { }
    private final TechnicianInvitationService invitations;
    public TechnicianInvitationController(TechnicianInvitationService invitations) { this.invitations = invitations; }
    @PostMapping("/api/reports/{id}/technician-invitations")
    public TechnicianInvitationService.Sent invite(@PathVariable Long id, @Valid @RequestBody Request request,
            @RequestParam(defaultValue = "0") int page, @AuthenticationPrincipal AppUserDetails actor) {
        return invitations.invite(id, request.reason(), page, actor);
    }
    @GetMapping("/api/technician-invitations")
    public TechnicianInvitationService.Inbox inbox(@RequestParam(defaultValue = "0") int page,
            @AuthenticationPrincipal AppUserDetails actor) { return invitations.inbox(page, actor); }
}
