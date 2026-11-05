package com.example.fixflow;
import com.example.fixflow.domain.*;
import com.example.fixflow.repository.*;
import com.example.fixflow.service.SiteApplicationService;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.web.ApiException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import static org.junit.jupiter.api.Assertions.*;
@SpringBootTest
class SiteApplicationIntegrationTest {
 @Autowired SiteApplicationService service;
 @Autowired UserRepository users;
 @Autowired SiteRepository sites;
 @Autowired PasswordEncoder passwords;
 @Autowired SiteApplicationRepository applications;
 @Autowired org.springframework.web.context.WebApplicationContext context;
 private AppUserDetails operator(){User u=new User();u.setEmail("site-review-"+System.nanoTime()+"@test.invalid");u.setPasswordHash("unused");u.setFirstName("Site");u.setLastName("Reviewer");u.setRole(UserRole.super_admin);return new AppUserDetails(users.save(u));}
 private SiteApplicationService.Request request(String suffix){return new SiteApplicationService.Request("Organization","Campus "+suffix,SiteType.school,"Test address","applicant@test.invalid","12345678","Authorized employee","Intended","Admin","admin-"+suffix+"@test.invalid","87654321");}
 @Test void informationApprovalAndSingleUseSetupCreateIntendedAdmin(){
  String suffix=Long.toString(System.nanoTime());var input=request(suffix);var actor=operator();
  var receipt=service.submit(input);assertEquals("pending",service.track(receipt.trackingToken()).status());
  var item=service.list(actor).stream().filter(a->a.adminEmail().equals(input.adminEmail())).findFirst().orElseThrow();
  service.decide(item.id(),new SiteApplicationService.Decision("request_information","Confirm organization authority"),actor);
  assertEquals("information_requested",service.track(receipt.trackingToken()).status());
  service.amend(receipt.trackingToken(),input);
  var approved=service.decide(item.id(),new SiteApplicationService.Decision("approve","Authority reviewed"),actor);
  assertNotNull(approved.siteId());assertNotNull(approved.adminId());
  var admin=users.findById(approved.adminId()).orElseThrow();assertEquals(input.adminEmail(),admin.getEmail());assertEquals(UserRole.admin,admin.getRole());
  assertEquals(approved.siteId(),admin.getSite().getId());
  var invitation=service.issueSetup(item.id(),actor);
  assertNotEquals(invitation.setupToken(),applications.findById(item.id()).orElseThrow().getSetupHash());
  service.setup(invitation.setupToken(),"Unique site administrator passphrase");
  assertTrue(passwords.matches("Unique site administrator passphrase",users.findById(approved.adminId()).orElseThrow().getPasswordHash()));
  assertThrows(ApiException.class,()->service.setup(invitation.setupToken(),"Another valid administrator passphrase"));
  assertThrows(ApiException.class,()->service.decide(item.id(),new SiteApplicationService.Decision("approve","Repeat"),actor));
  assertEquals(6,service.history(item.id(),actor).size());
 }
 @Test void rejectionDoesNotCreateSiteAndNonSuperCannotReview(){
  long before=sites.count();var actor=operator();var input=request(Long.toString(System.nanoTime()));var receipt=service.submit(input);
  var item=service.list(actor).stream().filter(a->a.adminEmail().equals(input.adminEmail())).findFirst().orElseThrow();
  service.decide(item.id(),new SiteApplicationService.Decision("reject","Authority not established"),actor);
  assertEquals(before,sites.count());assertEquals("rejected",service.track(receipt.trackingToken()).status());
  assertThrows(ApiException.class,()->service.list(null));assertThrows(ApiException.class,()->service.amend(receipt.trackingToken(),input));
  assertThrows(ApiException.class,()->service.track("invalid"));
 }
 @Test void setupReissueInvalidatesPreviousTokenAndExpiryIsEnforced(){
  var actor=operator();var input=request(Long.toString(System.nanoTime()));service.submit(input);
  var item=service.list(actor).stream().filter(a->a.adminEmail().equals(input.adminEmail())).findFirst().orElseThrow();
  service.decide(item.id(),new SiteApplicationService.Decision("approve","Approved"),actor);
  var old=service.issueSetup(item.id(),actor);var replacement=service.issueSetup(item.id(),actor);
  assertThrows(ApiException.class,()->service.setup(old.setupToken(),"Valid long administrator password"));
  var stored=applications.findById(item.id()).orElseThrow();stored.setSetupExpiresAt(java.time.Instant.now().minusSeconds(1));applications.save(stored);
  assertThrows(ApiException.class,()->service.setup(replacement.setupToken(),"Valid long administrator password"));
 }
 @Test void publicTrackingRequiresCapabilityAndResponsesAreNotCached() throws Exception {
  var receipt=service.submit(request(Long.toString(System.nanoTime())));
  var mvc=org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup(context)
   .apply(org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity()).build();
  mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/site-applications/status")
    .header("X-Application-Token",receipt.trackingToken()))
   .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk())
   .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header().string("Cache-Control","no-store"))
   .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("contactEmail").doesNotExist());
  mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/site-applications/setup")
    .header("X-Setup-Token",receipt.trackingToken()).contentType("application/json").content("{\"password\":\"Valid long password\"}"))
   .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isForbidden());
 }
 @Test void existingAdminEmailConflictsWithoutCreatingSite(){
  var actor=operator();var input=request(Long.toString(System.nanoTime()));service.submit(input);
  var item=service.list(actor).stream().filter(a->a.adminEmail().equals(input.adminEmail())).findFirst().orElseThrow();
  User existing=new User();existing.setEmail(input.adminEmail());existing.setPasswordHash("unused");existing.setFirstName("Existing");existing.setLastName("Person");existing.setRole(UserRole.technician);users.save(existing);
  long before=sites.count();
  assertThrows(ApiException.class,()->service.decide(item.id(),new SiteApplicationService.Decision("approve","Reviewed"),actor));
  assertEquals(before,sites.count());assertEquals("pending",applications.findById(item.id()).orElseThrow().getStatus());
 }
 @Test void concurrentApprovalCreatesOnlyOneSiteAndAdministrator() throws Exception {
  var actor=operator();var input=request(Long.toString(System.nanoTime()));service.submit(input);
  var item=service.list(actor).stream().filter(a->a.adminEmail().equals(input.adminEmail())).findFirst().orElseThrow();
  long sitesBefore=sites.count();long usersBefore=users.count();
  var ready=new java.util.concurrent.CountDownLatch(2);var start=new java.util.concurrent.CountDownLatch(1);
  var executor=java.util.concurrent.Executors.newFixedThreadPool(2);
  try {
   java.util.concurrent.Callable<Integer> approve=()->{
    ready.countDown();
    if(!start.await(10,java.util.concurrent.TimeUnit.SECONDS)) throw new IllegalStateException("Approval start timed out");
    try { service.decide(item.id(),new SiteApplicationService.Decision("approve","Authority reviewed"),actor);return 200; }
    catch(ApiException ex){return ex.getStatus();}
   };
   var first=executor.submit(approve);var second=executor.submit(approve);
   assertTrue(ready.await(10,java.util.concurrent.TimeUnit.SECONDS));start.countDown();
   var outcomes=java.util.List.of(first.get(30,java.util.concurrent.TimeUnit.SECONDS),second.get(30,java.util.concurrent.TimeUnit.SECONDS));
   assertEquals(1,outcomes.stream().filter(status->status==200).count());
   assertEquals(1,outcomes.stream().filter(status->status==409).count());
   assertEquals(sitesBefore+1,sites.count());assertEquals(usersBefore+1,users.count());
   var approved=service.list(actor).stream().filter(a->a.id().equals(item.id())).findFirst().orElseThrow();
   assertEquals("approved",approved.status());assertNotNull(approved.siteId());assertNotNull(approved.adminId());
   var admin=users.findById(approved.adminId()).orElseThrow();
   assertEquals(input.adminEmail(),admin.getEmail());assertEquals(UserRole.admin,admin.getRole());assertEquals(approved.siteId(),admin.getSite().getId());
   assertEquals(1,service.history(item.id(),actor).stream().filter(a->a.action().equals("approve")).count());
  } finally {start.countDown();executor.shutdownNow();}
 }
 @Test void demotedSuperAdministratorCannotUseOldSession(){
  var actor=operator();User changed=users.findById(actor.getId()).orElseThrow();changed.setRole(UserRole.technician);users.save(changed);
  assertThrows(ApiException.class,()->service.list(actor));
 }
}
