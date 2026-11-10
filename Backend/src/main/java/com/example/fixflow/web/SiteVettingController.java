package com.example.fixflow.web;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import com.example.fixflow.domain.SiteTechnicianVetting;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.service.SiteVettingService;
@RestController @RequestMapping("/api/sites/{siteId}/technicians/{technicianId}/vetting")
public class SiteVettingController {
 private final SiteVettingService service;
 public SiteVettingController(SiteVettingService service) { this.service=service; }
 @GetMapping public ReviewResponse get(@PathVariable Long siteId,@PathVariable Long technicianId,@AuthenticationPrincipal AppUserDetails actor) { var review=service.get(siteId,technicianId,actor); return new ReviewResponse(review, review == null ? "unreviewed" : service.current(review) ? "approved" : "revoked".equals(review.getStatus()) ? "revoked" : "expired"); }
 public record ReviewResponse(SiteTechnicianVetting review, String status) {}
 @PostMapping public SiteTechnicianVetting record(@PathVariable Long siteId,@PathVariable Long technicianId,@RequestBody SiteVettingService.Review review,@AuthenticationPrincipal AppUserDetails actor) { return service.record(siteId,technicianId,review,actor); }
}
