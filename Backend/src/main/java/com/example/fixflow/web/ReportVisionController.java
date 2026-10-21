package com.example.fixflow.web;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import com.example.fixflow.service.ReportVisionService;
import com.example.fixflow.security.AppUserDetails;

@RestController @RequestMapping("/api/reports/{reportId}/vision")
public class ReportVisionController {
    private final ReportVisionService service;
    public ReportVisionController(ReportVisionService service) { this.service = service; }
    @PostMapping(consumes = "multipart/form-data")
    public ResponseEntity<ReportVisionService.Status> enqueue(@PathVariable Long reportId,
            @RequestParam MultipartFile image, @RequestParam(defaultValue = "false") boolean consent,
            @AuthenticationPrincipal AppUserDetails actor) {
        return ResponseEntity.accepted().body(service.enqueue(reportId, image, consent, actor));
    }
    @GetMapping("/{jobId}")
    public ReportVisionService.Status status(@PathVariable Long reportId, @PathVariable String jobId,
            @AuthenticationPrincipal AppUserDetails actor) { return service.get(reportId, jobId, actor); }
}
