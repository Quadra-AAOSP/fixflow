package com.example.fixflow.web;

import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import jakarta.validation.Valid;
import com.example.fixflow.dto.ContractApplicationRequest;
import com.example.fixflow.dto.ContractApplicationResponse;
import com.example.fixflow.dto.ContractDecisionRequest;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.service.ContractApplicationService;

@RestController
@RequestMapping("/api/technician-contract-requests")
public class ContractApplicationController {
    private final ContractApplicationService service;
    public ContractApplicationController(ContractApplicationService service) { this.service = service; }
    @PostMapping(consumes = "application/json")
    public ResponseEntity<ContractApplicationResponse> request(@Valid @RequestBody ContractApplicationRequest request,
            @AuthenticationPrincipal AppUserDetails actor) {
        return ResponseEntity.status(201).body(service.request(request, actor));
    }
    @GetMapping
    public List<ContractApplicationResponse> list(@RequestParam(required = false) Long siteId,
            @AuthenticationPrincipal AppUserDetails actor) { return service.list(siteId, actor); }
    @PostMapping(value = "/{id}/decision", consumes = "application/json")
    public ContractApplicationResponse decide(@PathVariable Long id, @Valid @RequestBody ContractDecisionRequest request,
            @AuthenticationPrincipal AppUserDetails actor) { return service.decide(id, request, actor); }
}
