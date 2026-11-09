package com.example.fixflow.service;
import com.example.fixflow.domain.*;
import com.example.fixflow.repository.*;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.web.ApiException;
import jakarta.validation.constraints.*;
import java.time.*;
import java.security.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.crypto.password.PasswordEncoder;

@Service @Transactional
public class SiteApplicationService {
 public record Request(@NotBlank @Size(max=255) String organization,@NotBlank @Size(max=255) String siteName,
  @NotNull SiteType siteType,@NotBlank @Size(max=512) String address,
  @NotBlank @Email @Size(max=255) String contactEmail,@NotBlank @Size(max=64) String contactPhone,
  @NotBlank @Size(max=1000) String relationship,@NotBlank @Size(max=128) String adminFirstName,
  @NotBlank @Size(max=128) String adminLastName,@NotBlank @Email @Size(max=255) String adminEmail,
  @NotBlank @Size(max=64) String adminPhone) {}
 public record Receipt(String trackingToken,String status) {}
 public record Status(String status,String message,Long siteId,boolean setupComplete) {}
 public record Review(Long id,String organization,String siteName,SiteType siteType,String address,
  String contactEmail,String contactPhone,String relationship,String adminFirstName,String adminLastName,
  String adminEmail,String adminPhone,String status,String message,Long siteId,Long adminId,Instant createdAt) {}
 public record Decision(@NotBlank @Pattern(regexp="approve|reject|request_information") String decision,
  @NotBlank @Size(max=2000) String reason) {}
 public record Delivery(String setupToken,Instant expiresAt,String delivery) {}
 private final SiteApplicationRepository applications; private final SiteRepository sites;
 private final UserRepository users; private final PasswordEncoder passwords;private final SiteApplicationAuditRepository audits;
 public SiteApplicationService(SiteApplicationRepository applications,SiteRepository sites,UserRepository users,PasswordEncoder passwords,SiteApplicationAuditRepository audits){
  this.applications=applications;this.sites=sites;this.users=users;this.passwords=passwords;this.audits=audits;
 }
 public Receipt submit(Request input){String token=token();SiteApplication value=new SiteApplication();
  value.setTrackingHash(hash(token)); apply(value,input);applications.saveAndFlush(value);audit(value,"submitted",null);return new Receipt(token,"pending");}
 public Status track(String token){return status(tracked(token));}
 public Status amend(String token,Request input){SiteApplication value=tracked(token);
  if(!value.getStatus().equals("information_requested")) throw new ApiException(409,"Application is not awaiting information");
  apply(value,input);value.setStatus("pending");audit(value,"resubmitted",null);return status(value);}
 public List<Review> list(AppUserDetails actor){superAdmin(actor);return applications.findAllByOrderByIdDesc().stream().map(this::review).toList();}
 public Review decide(Long id,Decision input,AppUserDetails actor){superAdmin(actor);
  SiteApplication value=applications.lockId(id).orElseThrow(()->new ApiException(404,"Application not found"));
  if(!value.getStatus().equals("pending"))throw new ApiException(409,"Application is not pending");
  if(input.decision().equals("approve")){
   if(users.existsByEmailIgnoreCase(value.getAdminEmail()))throw new ApiException(409,"Proposed administrator email cannot be provisioned; request corrected details");
   Site site=new Site();site.setName(value.getSiteName());site.setType(value.getSiteType());site.setAddress(value.getAddress());
   site.setDescription(value.getOrganization());site.setContractStatus(ContractStatus.uncontracted);sites.saveAndFlush(site);
   User admin=new User();admin.setEmail(value.getAdminEmail());admin.setFirstName(value.getAdminFirstName());admin.setLastName(value.getAdminLastName());
   admin.setPhone(value.getAdminPhone());admin.setRole(UserRole.admin);admin.setSite(site);admin.setPasswordHash(passwords.encode(token()));
   try{users.saveAndFlush(admin);}catch(org.springframework.dao.DataIntegrityViolationException ex){throw new ApiException(409,"Proposed administrator cannot be provisioned; review account details");}
   value.setSiteId(site.getId());value.setAdminId(admin.getId());value.setStatus("approved");
  } else value.setStatus(input.decision().equals("reject")?"rejected":"information_requested");
  value.setReviewMessage(input.reason().trim());value.setReviewedBy(actor.getId());value.setReviewedAt(Instant.now());audit(value,input.decision(),actor.getId());return review(value);
 }
 public Delivery issueSetup(Long id,AppUserDetails actor){superAdmin(actor);
  SiteApplication value=applications.lockId(id).orElseThrow(()->new ApiException(404,"Application not found"));
  if(!value.getStatus().equals("approved") || value.getSetupUsedAt()!=null)throw new ApiException(409,"Setup is unavailable");
  String token=token();value.setSetupHash(hash(token));value.setSetupExpiresAt(Instant.now().plus(Duration.ofHours(24)));
  audit(value,"setup_issued",actor.getId());return new Delivery(token,value.getSetupExpiresAt(),"Authorized administrator must securely deliver this token to the proposed site admin; no email was sent");
 }
 public void setup(String token,String password){AccountPolicy.validatePassword(password);
  SiteApplication value=applications.lockSetup(hash(token)).orElseThrow(()->new ApiException(400,"Invalid or expired setup token"));
  if(value.getSetupUsedAt()!=null || value.getSetupExpiresAt()==null || !Instant.now().isBefore(value.getSetupExpiresAt()))throw new ApiException(400,"Invalid or expired setup token");
  User admin=users.findById(value.getAdminId()).orElseThrow(()->new ApiException(409,"Administrator unavailable"));
  if(admin.getRole()!=UserRole.admin || admin.getSite()==null || !admin.getSite().getId().equals(value.getSiteId()))throw new ApiException(409,"Administrator changed; contact support");
  admin.setPasswordHash(passwords.encode(password));value.setSetupUsedAt(Instant.now());value.setSetupHash(null);audit(value,"setup_completed",admin.getId());
 }
 private SiteApplication tracked(String token){return applications.lockTracking(hash(token)).orElseThrow(()->new ApiException(404,"Application not found"));}
 public record Audit(Long id,String action,Long actorId,String snapshot,Instant createdAt){}
 public List<Audit> history(Long id,AppUserDetails actor){superAdmin(actor);return audits.findByApplicationIdOrderByIdAsc(id).stream().map(a->new Audit(a.getId(),a.getAction(),a.getActorId(),a.getSnapshot(),a.getCreatedAt())).toList();}
 private void audit(SiteApplication v,String action,Long actor){SiteApplicationAudit a=new SiteApplicationAudit();a.setApplicationId(v.getId());a.setAction(action);a.setActorId(actor);try{a.setSnapshot(new com.fasterxml.jackson.databind.ObjectMapper().findAndRegisterModules().writeValueAsString(review(v)));}catch(Exception ex){throw new IllegalStateException("Could not record onboarding audit",ex);}audits.save(a);}
 private Status status(SiteApplication v){return new Status(v.getStatus(),v.getReviewMessage(),v.getSiteId(),v.getSetupUsedAt()!=null);}
 private Review review(SiteApplication v){return new Review(v.getId(),v.getOrganization(),v.getSiteName(),v.getSiteType(),v.getAddress(),v.getContactEmail(),v.getContactPhone(),v.getRelationship(),v.getAdminFirstName(),v.getAdminLastName(),v.getAdminEmail(),v.getAdminPhone(),v.getStatus(),v.getReviewMessage(),v.getSiteId(),v.getAdminId(),v.getCreatedAt());}
 private void apply(SiteApplication v,Request r){v.setOrganization(r.organization().trim());v.setSiteName(r.siteName().trim());v.setSiteType(r.siteType());v.setAddress(r.address().trim());v.setContactEmail(r.contactEmail().trim().toLowerCase(Locale.ROOT));v.setContactPhone(r.contactPhone().trim());v.setRelationship(r.relationship().trim());v.setAdminFirstName(r.adminFirstName().trim());v.setAdminLastName(r.adminLastName().trim());v.setAdminEmail(r.adminEmail().trim().toLowerCase(Locale.ROOT));v.setAdminPhone(r.adminPhone().trim());}
 private void superAdmin(AppUserDetails actor){if(actor==null || actor.getRole()!=UserRole.super_admin
   || users.findById(actor.getId()).map(u->u.getRole()!=UserRole.super_admin).orElse(true))throw new ApiException(403,"Super admin required");}
 private static String token(){byte[] bytes=new byte[32];new SecureRandom().nextBytes(bytes);return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);}
 private static String hash(String token){if(token==null || !token.matches("[A-Za-z0-9_-]{43}"))throw new ApiException(400,"Invalid token");try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));}catch(NoSuchAlgorithmException e){throw new IllegalStateException(e);}}
}
