package com.example.fixflow.web;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.service.ReportAssistantService;

/**
 * Stateless chat about a single report. The client sends the message
 * history each request; the server rebuilds the system prompt from current
 * report data and answers with the assistant's next reply.
 */
@RestController
@RequestMapping("/api/reports/{reportId}/assistant")
public class ReportAssistantController {

    private final ReportAssistantService service;

    public ReportAssistantController(ReportAssistantService service) {
        this.service = service;
    }

    @PostMapping
    public ReportAssistantService.AssistantReply ask(
            @PathVariable Long reportId,
            @RequestBody ReportAssistantService.AssistantChatRequest request,
            @AuthenticationPrincipal AppUserDetails actor) {
        return service.ask(reportId, request == null ? null : request.messages(), actor);
    }
}
