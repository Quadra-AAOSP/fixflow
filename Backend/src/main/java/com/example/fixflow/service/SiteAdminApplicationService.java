package com.example.fixflow.service;

import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.example.fixflow.domain.SiteAdminApplication;
import com.example.fixflow.domain.User;
import com.example.fixflow.domain.UserRole;
import com.example.fixflow.repository.SiteAdminApplicationRepository;
import com.example.fixflow.repository.UserRepository;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.web.ApiException;

@Service
public class SiteAdminApplicationService {
    public record Response(Long id, Long userId, Long siteId, SiteAdminApplication.Status status,
            Instant createdAt, Instant decidedAt, Long decidedBy) {
        static Response from(SiteAdminApplication item) {
            return new Response(item.getId(), item.getUser().getId(), item.getSite().getId(),
                    item.getStatus(), item.getCreatedAt(), item.getDecidedAt(),
                    item.getDecidedBy() == null ? null : item.getDecidedBy().getId());
        }
    }
    private final SiteAdminApplicationRepository applications;
    private final UserRepository users;
    public SiteAdminApplicationService(SiteAdminApplicationRepository applications, UserRepository users) {
        this.applications = applications;
        this.users = users;
    }
    @Transactional
    public void submit(User user) {
        SiteAdminApplication application = new SiteAdminApplication();
        application.setUser(user);
        application.setSite(user.getSite());
        applications.save(application);
    }
    @Transactional(readOnly = true)
    public Response mine(AppUserDetails actor) {
        return applications.findByUser_Id(actor.getId()).map(Response::from).orElse(null);
    }
    @Transactional(readOnly = true)
    public List<Response> pending(AppUserDetails actor) {
        requireSuperAdmin(actor);
        return applications.findByStatusOrderByCreatedAtAsc(SiteAdminApplication.Status.pending)
                .stream().map(Response::from).toList();
    }
    @Transactional
    public Response decide(Long id, boolean approve, AppUserDetails actor) {
        requireSuperAdmin(actor);
        SiteAdminApplication item = applications.findForDecision(id)
                .orElseThrow(() -> new ApiException(404, "Site admin application not found"));
        if (item.getStatus() != SiteAdminApplication.Status.pending) {
            throw new ApiException(409, "Application already decided");
        }
        User applicant = item.getUser();
        if (applicant.getRole() != UserRole.reporter || applicant.getSite() == null
                || !applicant.getSite().getId().equals(item.getSite().getId())) {
            throw new ApiException(409, "Applicant account changed; review required");
        }
        if (approve) applicant.setRole(UserRole.admin);
        item.setStatus(approve ? SiteAdminApplication.Status.approved : SiteAdminApplication.Status.rejected);
        item.setDecidedAt(Instant.now());
        item.setDecidedBy(users.findById(actor.getId()).orElseThrow(() -> new ApiException(401, "User not found")));
        return Response.from(item);
    }
    private void requireSuperAdmin(AppUserDetails actor) {
        if (actor == null || actor.getRole() != UserRole.super_admin) {
            throw new ApiException(403, "Only super_admin can decide site admin applications");
        }
    }
}
