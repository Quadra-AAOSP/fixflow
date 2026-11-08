package com.example.fixflow.web;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.service.ReportTriageService;

@RestController
public class ReportTriageController {
    private final ReportTriageService triage;

    public ReportTriageController(ReportTriageService triage) {
        this.triage = triage;
    }

    @PostMapping("/api/assistant/triage")
    public ReportTriageService.Reply ask(@RequestBody ReportTriageService.Request request,
            @AuthenticationPrincipal AppUserDetails actor) {
        return triage.ask(request, actor);
    }
}
