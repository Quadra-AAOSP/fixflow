package com.example.fixflow;
import java.time.Instant;
import com.example.fixflow.domain.*;
import com.example.fixflow.repository.*;
final class VettingFixture {
 static void eligible(User tech, Site site, User reviewer, TechnicianTermsAcceptanceRepository terms, TechnicianVerificationRepository verifications, SiteTechnicianVettingRepository reviews) {
  var a=new TechnicianTermsAcceptance(); a.setTechnician(tech); a.setTermsVersion("test-v1"); a.setDocumentUrl("https://example.test/terms"); terms.save(a);
  var v=verifications.findById(tech.getId()).orElseGet(TechnicianVerification::new); v.setTechnicianId(tech.getId()); v.setStatus("verified"); v.setIdentityChecked(true); v.setEmailChecked(true); v.setPhoneChecked(true); v.setTradeChecked(true); v.setTrades("plumbing"); verifications.save(v);
  var r=new SiteTechnicianVetting(); r.setSiteId(site.getId()); r.setTechnicianId(tech.getId()); r.setStatus("approved"); r.setReviewedBy(reviewer.getId()); r.setReviewedAt(Instant.now()); r.setExpiresAt(Instant.now().plusSeconds(86400)); r.setIdentityChecked(true); r.setReferencesChecked(true); r.setQualificationsChecked(true); reviews.save(r);
 }
}
