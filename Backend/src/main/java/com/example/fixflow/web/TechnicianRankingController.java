package com.example.fixflow.web;

import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.service.TechnicianRankingService;

@RestController
@RequestMapping("/api/reports/{id}/technician-ranking")
public class TechnicianRankingController {
    public record Request(@NotNull TechnicianRankingService.Mode mode) { }
    private final TechnicianRankingService ranking;
    public TechnicianRankingController(TechnicianRankingService ranking) { this.ranking = ranking; }
    @PostMapping
    public TechnicianRankingService.Result rank(@PathVariable Long id, @Valid @RequestBody Request request,
            @AuthenticationPrincipal AppUserDetails actor) {
        return ranking.rank(id, request.mode(), actor);
    }
}
