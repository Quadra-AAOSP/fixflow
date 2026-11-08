package com.example.fixflow;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;
import com.example.fixflow.domain.*;
import com.example.fixflow.repository.*;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.web.*;
import java.util.Optional;
import org.junit.jupiter.api.Test;
class TechnicianVerificationTest {
 TechnicianVerificationRepository records=mock(TechnicianVerificationRepository.class);
 TechnicianVerificationAuditRepository audits=mock(TechnicianVerificationAuditRepository.class);
 UserRepository users=mock(UserRepository.class);
 TechnicianSkillRepository skills=mock(TechnicianSkillRepository.class);
 TechnicianVerificationController controller=new TechnicianVerificationController(records,audits,users,skills);
 AppUserDetails actor(UserRole role){User user=new User();user.setId(1L);user.setRole(role);when(users.findById(1L)).thenReturn(Optional.of(user));return new AppUserDetails(user);}
 @Test void unsubmittedTechnicianIsUnverified(){assertEquals("unverified",controller.mine(actor(UserRole.technician)).getStatus());verifyNoInteractions(audits);}
 @Test void initialDefaultsReuseAccountAndTradesWithoutReplacingPriorSubmission(){
  var principal=actor(UserRole.technician);
  User account=new User();account.setRole(UserRole.technician);account.setEmail("tech@example.test");account.setPhone("123456789");
  when(users.findById(1L)).thenReturn(Optional.of(account));
  TechnicianSkill skill=new TechnicianSkill();skill.setCategory("plumbing");skill.setSpecialty("pipes");
  when(skills.findByTechnician_IdInOrderByIdAsc(java.util.List.of(1L))).thenReturn(java.util.List.of(skill));
  var initial=controller.mine(principal);
  assertEquals("tech@example.test",initial.getEmail());assertEquals("123456789",initial.getPhone());assertEquals("plumbing — pipes",initial.getTrades());
  var rejected=new TechnicianVerification();rejected.setStatus("rejected");rejected.setEmail("corrected@example.test");rejected.setTrades("corrected");
  when(records.findById(1L)).thenReturn(Optional.of(rejected));
  assertSame(rejected,controller.mine(principal));assertEquals("corrected@example.test",controller.mine(principal).getEmail());
  verify(records,never()).save(any());
 }
 @Test void technicianCannotReview(){assertThrows(ApiException.class,()->controller.list(actor(UserRole.technician)));}
 @Test void staleRoleCannotReview(){var principal=actor(UserRole.super_admin);User changed=new User();changed.setRole(UserRole.reporter);when(users.findById(1L)).thenReturn(Optional.of(changed));assertThrows(ApiException.class,()->controller.list(principal));}
 @Test void approvalRequiresManualChecks(){var actor=actor(UserRole.super_admin);var value=new TechnicianVerification();value.setTechnicianId(7L);value.setVersion(2L);value.setStatus("pending");when(records.findById(7L)).thenReturn(Optional.of(value));assertThrows(ApiException.class,()->controller.decide(7L,new TechnicianVerificationController.Decision("verified","Reviewed",true,false,true,true,2L),actor));verify(records,never()).saveAndFlush(any());}
 @Test void staleDecisionsRejected(){var actor=actor(UserRole.super_admin);var value=new TechnicianVerification();value.setVersion(2L);value.setStatus("pending");when(records.findById(7L)).thenReturn(Optional.of(value));assertThrows(ApiException.class,()->controller.decide(7L,new TechnicianVerificationController.Decision("verified","Reviewed",true,true,true,true,1L),actor));}
 @Test void submissionResetsChecksAndAppendsAudit(){var actor=actor(UserRole.technician);var result=controller.submit(new TechnicianVerificationController.Submission("tech@example.test","123456789","Plumbing","Three years","References available"),actor);assertEquals("pending",result.getStatus());assertFalse(result.isIdentityChecked());verify(audits).save(any());}
 @Test void reviewerApprovalAppendsSnapshot(){var actor=actor(UserRole.super_admin);var value=new TechnicianVerification();value.setTechnicianId(7L);value.setVersion(2L);value.setStatus("pending");when(records.findById(7L)).thenReturn(Optional.of(value));var approved=controller.decide(7L,new TechnicianVerificationController.Decision("verified","Identity and reference checks completed manually",true,true,true,true,2L),actor);assertEquals("verified",approved.getStatus());assertEquals(1L,approved.getReviewedBy());verify(audits).save(argThat(a->a.getSnapshot().contains("verified")&&a.getActorId().equals(1L)));}
 @Test void suspendedTechnicianCannotSelfResubmit(){var actor=actor(UserRole.technician);var value=new TechnicianVerification();value.setStatus("suspended");when(records.findById(1L)).thenReturn(Optional.of(value));assertThrows(ApiException.class,()->controller.submit(new TechnicianVerificationController.Submission("tech@example.test","123456789","Plumbing","Three years","References"),actor));verifyNoInteractions(audits);}
 @Test void rejectedResubmissionClearsPriorReviewerChecks(){var actor=actor(UserRole.technician);var value=new TechnicianVerification();value.setStatus("rejected");value.setIdentityChecked(true);value.setReviewedBy(9L);when(records.findById(1L)).thenReturn(Optional.of(value));var result=controller.submit(new TechnicianVerificationController.Submission("tech@example.test","123456789","Plumbing","Three years","Updated references"),actor);assertEquals("pending",result.getStatus());assertFalse(result.isIdentityChecked());assertNull(result.getReviewedBy());verify(audits).save(any());}
 @Test void escapedMaximumLengthSubmissionKeepsCompleteAudit(){var actor=actor(UserRole.technician);String text="\"".repeat(4000);controller.submit(new TechnicianVerificationController.Submission("tech@example.test","123456789","Trades",text,text),actor);verify(audits).save(argThat(a->a.getSnapshot().length()>16000&&a.getSnapshot().contains("qualifications")));}
}
