package com.example.fixflow.web;

import com.example.fixflow.domain.Urgency;
import com.example.fixflow.dto.ReportResponse;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.service.ReportWorkflowService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/reports/{id}")
public class ReportWorkflowController {
    public record Resolve(@NotBlank @Size(max=10000) String description) { }
    public record Reason(@NotBlank @Size(max=2000) String reason) { }
    public record Override(@NotNull Urgency urgency,@NotBlank @Size(max=2000) String reason) { }
    public record Rating(@NotNull @Positive Long resolutionId,@Min(1) @Max(5) int score,@Size(max=2000) String feedback) { }
    public record Link(@NotNull @Positive Long linkedReportId,@NotBlank @Size(max=2000) String reason) { }
    private final ReportWorkflowService service;
    public ReportWorkflowController(ReportWorkflowService service){this.service=service;}
    @PostMapping("/claim") public ReportResponse claim(@PathVariable Long id,@AuthenticationPrincipal AppUserDetails actor){return service.claim(id,actor);}
    @PostMapping("/start") public ReportResponse start(@PathVariable Long id,@AuthenticationPrincipal AppUserDetails actor){return service.start(id,actor);}
    @PostMapping("/resolve") public ReportResponse resolve(@PathVariable Long id,@Valid @RequestBody Resolve body,@AuthenticationPrincipal AppUserDetails actor){return service.resolve(id,body.description(),actor);}
    @PostMapping("/escalate") public ReportResponse escalate(@PathVariable Long id,@Valid @RequestBody Reason body,@AuthenticationPrincipal AppUserDetails actor){return service.escalate(id,body.reason(),actor);}
    @PatchMapping("/urgency") public ReportResponse urgency(@PathVariable Long id,@Valid @RequestBody Override body,@AuthenticationPrincipal AppUserDetails actor){return service.urgency(id,body.urgency(),body.reason(),actor);}
    @GetMapping("/history") public List<ReportWorkflowService.HistoryItem> history(@PathVariable Long id,@AuthenticationPrincipal AppUserDetails actor){return service.history(id,actor);}
    @GetMapping("/resolutions") public List<ReportWorkflowService.ResolutionItem> resolutions(@PathVariable Long id,@AuthenticationPrincipal AppUserDetails actor){return service.resolutions(id,actor);}
    @PostMapping("/ratings") public ReportWorkflowService.RatingItem rate(@PathVariable Long id,@Valid @RequestBody Rating body,@AuthenticationPrincipal AppUserDetails actor){return service.rate(id,body.resolutionId(),body.score(),body.feedback(),actor);}
    @GetMapping("/ratings") public List<ReportWorkflowService.RatingItem> ratings(@PathVariable Long id,@AuthenticationPrincipal AppUserDetails actor){return service.ratings(id,actor);}
    @PostMapping("/links") public ReportWorkflowService.LinkItem link(@PathVariable Long id,@Valid @RequestBody Link body,@AuthenticationPrincipal AppUserDetails actor){return service.link(id,body.linkedReportId(),body.reason(),actor);}
    @GetMapping("/links") public List<ReportWorkflowService.LinkItem> links(@PathVariable Long id,@AuthenticationPrincipal AppUserDetails actor){return service.links(id,actor);}
}
