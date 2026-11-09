package com.example.fixflow;

import com.example.fixflow.domain.*;
import com.example.fixflow.repository.*;
import com.example.fixflow.security.AppUserDetails;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
class TechnicianVerificationApiIntegrationTest {
    @Autowired WebApplicationContext context;
    @Autowired UserRepository users;
    @Autowired TechnicianVerificationRepository records;
    @Autowired TechnicianVerificationAuditRepository audits;

    User account(UserRole role) {
        User user=new User(); user.setEmail("verification-"+System.nanoTime()+"@test.invalid");
        user.setFirstName("Verification"); user.setLastName("Browser"); user.setRole(role);
        user.setPasswordHash("unused-test-password"); return users.save(user);
    }

    @Test void submissionReviewAuditAndSuspensionPersistThroughSecuredApi() throws Exception {
        var mvc=MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        User technician=account(UserRole.technician),superAdmin=account(UserRole.super_admin);
        String own="/api/technician-verification/me";
        String submission="{\"email\":\"contact@test.invalid\",\"phone\":\"12345678\",\"trades\":\"Plumbing\",\"experience\":\"Three years\",\"qualifications\":\"Reference checked externally\"}";
        mvc.perform(get(own)).andExpect(status().isUnauthorized());
        mvc.perform(post(own).with(user(new AppUserDetails(technician))).contentType(MediaType.APPLICATION_JSON).content(submission))
                .andExpect(status().isForbidden());
        mvc.perform(post(own).with(user(new AppUserDetails(technician))).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(submission))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store"))
                .andExpect(jsonPath("status").value("pending"));
        Long version=records.findById(technician.getId()).orElseThrow().getVersion();
        String decisionPath="/api/admin/technician-verifications/"+technician.getId()+"/decision";
        String decision="{\"status\":\"verified\",\"reason\":\"Manual checks completed\",\"identityChecked\":true,\"emailChecked\":true,\"phoneChecked\":true,\"tradeChecked\":true,\"version\":"+version+"}";
        mvc.perform(post(decisionPath).with(user(new AppUserDetails(technician))).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(decision))
                .andExpect(status().isForbidden());
        mvc.perform(post(decisionPath).with(user(new AppUserDetails(superAdmin))).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(decision))
                .andExpect(status().isOk()).andExpect(jsonPath("status").value("verified"));
        mvc.perform(post(decisionPath).with(user(new AppUserDetails(superAdmin))).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(decision))
                .andExpect(status().isConflict());
        var stored=records.findById(technician.getId()).orElseThrow();
        org.junit.jupiter.api.Assertions.assertTrue(stored.isTradeChecked());
        org.junit.jupiter.api.Assertions.assertEquals(2,audits.findByTechnicianIdOrderByIdAsc(technician.getId()).size());
        mvc.perform(post(decisionPath).with(user(new AppUserDetails(superAdmin))).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"suspended\",\"reason\":\"Review required\",\"identityChecked\":true,\"emailChecked\":true,\"phoneChecked\":true,\"tradeChecked\":true,\"version\":"+stored.getVersion()+"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("status").value("suspended"));
        mvc.perform(post(own).with(user(new AppUserDetails(technician))).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(submission))
                .andExpect(status().isConflict());
    }
}
