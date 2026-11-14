package com.example.fixflow.service;
import java.time.Instant;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.example.fixflow.domain.*;
import com.example.fixflow.repository.*;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.web.ApiException;
@Service
public class SiteVettingService {
 private final SiteTechnicianVettingRepository reviews; private final TechnicianVerificationRepository verifications;
 private final TechnicianTermsService terms; private final UserRepository users; private final SiteRepository sites;
 private final NotificationService notifier;
 public SiteVettingService(SiteTechnicianVettingRepository reviews, TechnicianVerificationRepository verifications, TechnicianTermsService terms, UserRepository users, SiteRepository sites, NotificationService notifier) { this.reviews=reviews; this.verifications=verifications; this.terms=terms; this.users=users; this.sites=sites; this.notifier=notifier; }
 public record Review(String status, Instant expiresAt, boolean identityChecked, boolean referencesChecked, boolean qualificationsChecked, Boolean licenceApplicable, boolean licenceChecked, Instant licenceExpiresAt, Boolean insuranceApplicable, boolean insuranceChecked, Instant insuranceExpiresAt) {}
 public boolean current(SiteTechnicianVetting r) { Instant now=Instant.now(); return r != null && "approved".equals(r.getStatus()) && r.getExpiresAt()!=null && r.getExpiresAt().isAfter(now) && r.isIdentityChecked() && r.isReferencesChecked() && r.isQualificationsChecked() && (!r.isLicenceApplicable() || (r.isLicenceChecked() && r.getLicenceExpiresAt()!=null && r.getLicenceExpiresAt().isAfter(now))) && (!r.isInsuranceApplicable() || (r.isInsuranceChecked() && r.getInsuranceExpiresAt()!=null && r.getInsuranceExpiresAt().isAfter(now))); }
 public void requireEligible(Long technicianId, Long siteId) {
  terms.requireAcceptance(technicianId);
  var v=verifications.findById(technicianId).orElse(null);
  if (v==null) throw new ApiException(409,"Technician has not submitted platform verification");
  if (!"verified".equals(v.getStatus())) throw new ApiException(409,"Platform verification is "+v.getStatus()+", not verified");
  if (!v.isIdentityChecked() || !v.isEmailChecked() || !v.isPhoneChecked() || !v.isTradeChecked()) throw new ApiException(409,"Platform verification is missing the identity, email, phone or trade check");
  if (v.getTrades()==null || v.getTrades().isBlank()) throw new ApiException(409,"Platform verification has no trades recorded");
  if (!current(reviews.findFirstBySiteIdAndTechnicianIdOrderByIdDesc(siteId,technicianId).orElse(null))) throw new ApiException(409,"No current site vetting approval for " + sites.findById(siteId).map(Site::getName).orElse("this site"));
 }
 private void authorize(Long siteId, Long technicianId, AppUserDetails actor, boolean write) {
  boolean admin=actor.getRole()==UserRole.super_admin || (actor.getRole()==UserRole.admin && siteId.equals(actor.getSiteId()));
  boolean self=!write && actor.getRole()==UserRole.technician && technicianId.equals(actor.getId());
  if (!admin && !self) throw new ApiException(403,"Not allowed to access site vetting");
 }
 @Transactional(readOnly=true) public SiteTechnicianVetting get(Long siteId, Long technicianId, AppUserDetails actor) { authorize(siteId,technicianId,actor,false); return reviews.findFirstBySiteIdAndTechnicianIdOrderByIdDesc(siteId,technicianId).orElse(null); }
 @Transactional public SiteTechnicianVetting record(Long siteId, Long technicianId, Review input, AppUserDetails actor) {
  authorize(siteId,technicianId,actor,true);
  if (!sites.existsById(siteId) || users.findById(technicianId).filter(u -> u.getRole()==UserRole.technician).isEmpty()) throw new ApiException(404,"Site or technician not found");
  if (input.licenceApplicable() == null || input.insuranceApplicable() == null) throw new ApiException(400,"Specify whether licence and insurance checks apply");
  if (!"approved".equals(input.status()) && !"revoked".equals(input.status())) throw new ApiException(400,"Status must be approved or revoked");
  var r=new SiteTechnicianVetting(); r.setSiteId(siteId); r.setTechnicianId(technicianId); r.setStatus(input.status()); r.setReviewedBy(actor.getId()); r.setReviewedAt(Instant.now()); r.setExpiresAt(input.expiresAt()); r.setIdentityChecked(input.identityChecked()); r.setReferencesChecked(input.referencesChecked()); r.setQualificationsChecked(input.qualificationsChecked()); r.setLicenceApplicable(input.licenceApplicable()); r.setLicenceChecked(input.licenceChecked()); r.setLicenceExpiresAt(input.licenceExpiresAt()); r.setInsuranceApplicable(input.insuranceApplicable()); r.setInsuranceChecked(input.insuranceChecked()); r.setInsuranceExpiresAt(input.insuranceExpiresAt());
  if ("approved".equals(r.getStatus()) && !current(r)) throw new ApiException(400,"Complete all applicable checks and provide future expiry dates");
  reviews.save(r);
  notifier.send(technicianId, "approved".equals(r.getStatus())
    ? ReportNotification.Type.vetting_approved : ReportNotification.Type.vetting_revoked, null, siteId);
  return r;
 }
}
