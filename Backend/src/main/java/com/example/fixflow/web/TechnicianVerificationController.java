package com.example.fixflow.web;
import com.example.fixflow.domain.*;
import com.example.fixflow.repository.*;
import com.example.fixflow.security.AppUserDetails;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@RestController @Transactional
public class TechnicianVerificationController {
 @ModelAttribute public void preventCaching(jakarta.servlet.http.HttpServletResponse response){response.setHeader("Cache-Control","no-store");}
 @ExceptionHandler(org.springframework.orm.ObjectOptimisticLockingFailureException.class)
 @ResponseStatus(org.springframework.http.HttpStatus.CONFLICT)
 public java.util.Map<String,String> concurrentReview(){return java.util.Map.of("message","Review changed; refresh before deciding");}
 public record Submission(@NotBlank @Email @Size(max=255) String email,@NotBlank @Size(max=128) String phone,
  @NotBlank @Size(max=2000) String trades,@NotBlank @Size(max=4000) String experience,@NotBlank @Size(max=4000) String qualifications) { }
 public record Decision(@NotBlank String status,@NotBlank @Size(max=2000) String reason,
  boolean identityChecked,boolean emailChecked,boolean phoneChecked,boolean tradeChecked,@NotNull Long version) { }
 private final TechnicianVerificationRepository records;
 private final TechnicianVerificationAuditRepository audits;
 private final UserRepository users;
 public TechnicianVerificationController(TechnicianVerificationRepository records,TechnicianVerificationAuditRepository audits,UserRepository users){this.records=records;this.audits=audits;this.users=users;}
 private void role(AppUserDetails actor,UserRole expected){
  if(actor==null || actor.getRole()!=expected || users.findById(actor.getId()).map(User::getRole).orElse(null)!=expected) throw new ApiException(403,"Role not authorized");
 }
 @GetMapping("/api/technician-verification/me") public TechnicianVerification mine(@AuthenticationPrincipal AppUserDetails actor){
  role(actor,UserRole.technician);return records.findById(actor.getId()).orElseGet(()->{var value=new TechnicianVerification();value.setTechnicianId(actor.getId());return value;});
 }
 @PostMapping("/api/technician-verification/me") public TechnicianVerification submit(@Valid @RequestBody Submission body,@AuthenticationPrincipal AppUserDetails actor){
  role(actor,UserRole.technician);var value=records.findById(actor.getId()).orElseGet(TechnicianVerification::new);
  if(List.of("pending","verified","suspended").contains(value.getStatus())) throw new ApiException(409,"Current verification state does not permit submission");
  value.setTechnicianId(actor.getId());value.setEmail(body.email().trim());value.setPhone(body.phone().trim());value.setTrades(body.trades().trim());value.setExperience(body.experience().trim());value.setQualifications(body.qualifications().trim());
  value.setStatus("pending");value.setReason(null);value.setReviewedBy(null);value.setIdentityChecked(false);value.setEmailChecked(false);value.setPhoneChecked(false);value.setTradeChecked(false);
  records.saveAndFlush(value);audit(value,actor);return value;
 }
 @GetMapping("/api/admin/technician-verifications") public List<TechnicianVerification> list(@AuthenticationPrincipal AppUserDetails actor){role(actor,UserRole.super_admin);return records.findAll();}
 @GetMapping("/api/admin/technician-verifications/{id}/history") public List<TechnicianVerificationAudit> history(@PathVariable Long id,@AuthenticationPrincipal AppUserDetails actor){role(actor,UserRole.super_admin);return audits.findByTechnicianIdOrderByIdAsc(id);}
 @PostMapping("/api/admin/technician-verifications/{id}/decision") public TechnicianVerification decide(@PathVariable Long id,@Valid @RequestBody Decision body,@AuthenticationPrincipal AppUserDetails actor){
  role(actor,UserRole.super_admin);var value=records.findById(id).orElseThrow(()->new ApiException(404,"Verification not found"));
  if(!body.version().equals(value.getVersion())) throw new ApiException(409,"Review changed; refresh before deciding");
  boolean reviewing=value.getStatus().equals("pending") && List.of("verified","rejected").contains(body.status());
  boolean suspending=value.getStatus().equals("verified") && body.status().equals("suspended");
  boolean reopening=List.of("suspended","rejected").contains(value.getStatus()) && body.status().equals("pending");
  if(!reviewing&&!suspending&&!reopening) throw new ApiException(409,"Invalid verification transition");
  if(body.status().equals("verified")&&!(body.identityChecked()&&body.emailChecked()&&body.phoneChecked()&&body.tradeChecked())) throw new ApiException(400,"Record every manual review check before approval");
  value.setStatus(body.status());value.setReason(body.reason().trim());value.setReviewedBy(actor.getId());
  value.setIdentityChecked(body.identityChecked());value.setEmailChecked(body.emailChecked());value.setPhoneChecked(body.phoneChecked());value.setTradeChecked(body.tradeChecked());
  records.saveAndFlush(value);audit(value,actor);return value;
 }
 private void audit(TechnicianVerification value,AppUserDetails actor){
  var item=new TechnicianVerificationAudit();item.setTechnicianId(value.getTechnicianId());item.setActorId(actor.getId());item.setStatus(value.getStatus());
  try{item.setSnapshot(new com.fasterxml.jackson.databind.ObjectMapper().findAndRegisterModules().writeValueAsString(value));}catch(Exception ex){throw new IllegalStateException(ex);}
  audits.save(item);
 }
}
