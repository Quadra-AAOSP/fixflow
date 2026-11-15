package com.example.fixflow.service;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import com.example.fixflow.domain.*;
import com.example.fixflow.repository.*;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.web.ApiException;
class SiteVettingServiceTest {
 final SiteTechnicianVettingRepository reviews=mock(SiteTechnicianVettingRepository.class);
 final TechnicianVerificationRepository verifications=mock(TechnicianVerificationRepository.class);
 final TechnicianTermsService terms=mock(TechnicianTermsService.class);
 final UserRepository users=mock(UserRepository.class); final SiteRepository sites=mock(SiteRepository.class);
 final NotificationService notifier=mock(NotificationService.class);
 final SiteVettingService service=new SiteVettingService(reviews,verifications,terms,users,sites,notifier);
 SiteTechnicianVetting approved() { var r=new SiteTechnicianVetting(); r.setStatus("approved"); r.setExpiresAt(Instant.now().plusSeconds(3600)); r.setIdentityChecked(true); r.setReferencesChecked(true); r.setQualificationsChecked(true); return r; }
 @Test void approvedExpiryRevocationAndApplicableChecks() { var r=approved(); assertTrue(service.current(r)); r.setExpiresAt(Instant.now().minusSeconds(1)); assertFalse(service.current(r)); r=approved(); r.setStatus("revoked"); assertFalse(service.current(r)); r=approved(); r.setLicenceApplicable(true); assertFalse(service.current(r)); r.setLicenceChecked(true); r.setLicenceExpiresAt(Instant.now().plusSeconds(3600)); assertTrue(service.current(r)); r.setInsuranceApplicable(true); assertFalse(service.current(r)); }
 @Test void gateRequiresTermsVerificationAndCurrentSiteApproval() { var v=new TechnicianVerification(); v.setStatus("verified"); v.setIdentityChecked(true); v.setEmailChecked(true); v.setPhoneChecked(true); v.setTradeChecked(true); v.setTrades("electrical"); when(verifications.findById(4L)).thenReturn(Optional.of(v)); when(reviews.findFirstBySiteIdAndTechnicianIdOrderByIdDesc(2L,4L)).thenReturn(Optional.of(approved())); service.requireEligible(4L,2L); verify(terms).requireAcceptance(4L); assertThrows(ApiException.class,()->service.requireEligible(4L,3L)); v.setStatus("unverified"); assertThrows(ApiException.class,()->service.requireEligible(4L,2L)); }
 @Test void approvalRequiresExplicitApplicability() {
  var admin=new User(); admin.setRole(UserRole.super_admin); var tech=new User(); tech.setRole(UserRole.technician);
  when(sites.existsById(2L)).thenReturn(true); when(users.findById(4L)).thenReturn(Optional.of(tech));
  var input=new SiteVettingService.Review("approved",Instant.now().plusSeconds(3600),true,true,true,null,false,null,false,false,null);
  assertThrows(ApiException.class,()->service.record(2L,4L,input,new AppUserDetails(admin)));
 }
 @Test void wrongSiteAndRoleCannotRecord() { var u=new User(); u.setRole(UserRole.reporter); var actor=new AppUserDetails(u); assertThrows(ApiException.class,()->service.record(2L,4L,null,actor)); var site=new Site(); site.setId(3L); u.setRole(UserRole.admin); u.setSite(site); var other=new AppUserDetails(u); assertThrows(ApiException.class,()->service.record(2L,4L,null,other)); }
}
