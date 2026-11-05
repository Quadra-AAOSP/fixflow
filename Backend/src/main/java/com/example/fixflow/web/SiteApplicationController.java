package com.example.fixflow.web;
import com.example.fixflow.service.SiteApplicationService;
import com.example.fixflow.security.AppUserDetails;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.http.ResponseEntity;
import java.util.List;
@RestController
public class SiteApplicationController {
 @org.springframework.web.bind.annotation.ModelAttribute
 public void noStore(jakarta.servlet.http.HttpServletResponse response){response.setHeader("Cache-Control","no-store");}
 private final SiteApplicationService service;
 public SiteApplicationController(SiteApplicationService service){this.service=service;}
 public record Setup(@NotBlank @Size(min=15,max=100) String password) {}
 @PostMapping("/api/site-applications") public ResponseEntity<SiteApplicationService.Receipt> submit(@Valid @RequestBody SiteApplicationService.Request input){return ResponseEntity.status(201).body(service.submit(input));}
 @GetMapping("/api/site-applications/status") public SiteApplicationService.Status track(@RequestHeader("X-Application-Token") String token){return service.track(token);}
 @PutMapping("/api/site-applications/information") public SiteApplicationService.Status amend(@RequestHeader("X-Application-Token") String token,@Valid @RequestBody SiteApplicationService.Request input){return service.amend(token,input);}
 @PostMapping("/api/site-applications/setup") public ResponseEntity<Void> setup(@RequestHeader("X-Setup-Token") String token,@Valid @RequestBody Setup input){service.setup(token,input.password());return ResponseEntity.noContent().build();}
 @GetMapping("/api/admin/site-applications") public List<SiteApplicationService.Review> list(@AuthenticationPrincipal AppUserDetails actor){return service.list(actor);}
 @GetMapping("/api/admin/site-applications/{id}/history") public List<SiteApplicationService.Audit> history(@PathVariable Long id,@AuthenticationPrincipal AppUserDetails actor){return service.history(id,actor);}
 @PostMapping("/api/admin/site-applications/{id}/decision") public SiteApplicationService.Review decide(@PathVariable Long id,@Valid @RequestBody SiteApplicationService.Decision input,@AuthenticationPrincipal AppUserDetails actor){return service.decide(id,input,actor);}
 @PostMapping("/api/admin/site-applications/{id}/setup-invitation") public SiteApplicationService.Delivery invite(@PathVariable Long id,@AuthenticationPrincipal AppUserDetails actor){return service.issueSetup(id,actor);}
}
