package com.example.fixflow;
import static org.junit.jupiter.api.Assertions.*;
import com.example.fixflow.domain.*;
import com.example.fixflow.audit.*;
import com.example.fixflow.repository.*;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.web.TechnicianVerificationController;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;
@SpringBootTest @Transactional
class TechnicianVerificationPersistenceTest {
 @Autowired TechnicianVerificationController controller;
 @Autowired UserRepository users;
 @Autowired TechnicianVerificationAuditRepository audits;
 @Autowired jakarta.persistence.EntityManager entityManager;
 @Test void persistsEscapedMaximumLengthAuditWithoutTruncation(){
  var technician=new User();technician.setEmail("verify-"+System.nanoTime()+"@example.test");technician.setPasswordHash("test-only");technician.setFirstName("Test");technician.setLastName("Technician");technician.setRole(UserRole.technician);users.saveAndFlush(technician);
  Long id=technician.getId();String content="\"".repeat(4000);
  controller.submit(new TechnicianVerificationController.Submission(technician.getEmail(),"123456789","Plumbing",content,content),new AppUserDetails(technician));
  entityManager.flush();entityManager.clear();
  var saved=audits.findByTechnicianIdOrderByIdAsc(id);assertEquals(1,saved.size());
  assertTrue(saved.getFirst().getSnapshot().length()>16000);assertTrue(saved.getFirst().getSnapshot().contains("qualifications"));
 }
}
