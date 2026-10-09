package com.example.fixflow.service;

import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.example.fixflow.domain.Site;
import com.example.fixflow.domain.Subsite;
import com.example.fixflow.domain.SubsiteRequest.Status;
import com.example.fixflow.domain.User;
import com.example.fixflow.domain.UserRole;
import com.example.fixflow.dto.SubsiteAlertRequest;
import com.example.fixflow.dto.SubsiteAlertResponse;
import com.example.fixflow.dto.SubsiteRequest;
import com.example.fixflow.dto.SubsiteResponse;
import com.example.fixflow.repository.SiteRepository;
import com.example.fixflow.repository.SubsiteRepository;
import com.example.fixflow.repository.SubsiteRequestRepository;
import com.example.fixflow.repository.UserRepository;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.web.ApiException;

@Service
public class SubsiteService {
    private final SiteRepository sites; private final SubsiteRepository subsites; private final SubsiteRequestRepository alerts; private final UserRepository users;
    public SubsiteService(SiteRepository sites, SubsiteRepository subsites, SubsiteRequestRepository alerts, UserRepository users) { this.sites = sites; this.subsites = subsites; this.alerts = alerts; this.users = users; }
    @Transactional(readOnly = true) public List<SubsiteResponse> list(Long siteId, AppUserDetails actor) { assertCanView(siteId, actor); return subsites.findBySite_IdOrderByLabelAsc(siteId).stream().map(SubsiteResponse::from).toList(); }
    @Transactional public SubsiteResponse create(Long siteId, SubsiteRequest request, AppUserDetails actor) {
        assertCanManage(siteId, actor); String label = request.label().trim().toUpperCase();
        if (subsites.existsBySite_IdAndLabelIgnoreCase(siteId, label)) throw new ApiException(HttpStatus.CONFLICT.value(), "Subsite label already exists");
        Subsite subsite = new Subsite(); subsite.setSite(site(siteId)); subsite.setLabel(label); subsite.setName(request.name().trim()); subsite.setDescription(request.description()); return SubsiteResponse.from(subsites.save(subsite));
    }
    @Transactional public SubsiteAlertResponse requestAddition(Long siteId, SubsiteAlertRequest request, AppUserDetails actor) {
        assertCanView(siteId, actor); if (!subsites.findBySite_IdOrderByLabelAsc(siteId).isEmpty()) throw new ApiException(HttpStatus.CONFLICT.value(), "This site already has subsites");
        if (alerts.existsBySite_IdAndRequestedBy_IdAndStatus(siteId, actor.getId(), Status.pending)) throw new ApiException(HttpStatus.CONFLICT.value(), "A pending subsite request already exists");
        com.example.fixflow.domain.SubsiteRequest alert = new com.example.fixflow.domain.SubsiteRequest(); alert.setSite(site(siteId)); alert.setRequestedBy(user(actor.getId())); alert.setNote(request.note()); return SubsiteAlertResponse.from(alerts.save(alert));
    }
    @Transactional(readOnly = true) public List<SubsiteAlertResponse> pending(Long siteId, AppUserDetails actor) { assertCanManage(siteId, actor); return alerts.findBySite_IdAndStatusOrderByCreatedAtAsc(siteId, Status.pending).stream().map(SubsiteAlertResponse::from).toList(); }
    @Transactional public SubsiteAlertResponse resolve(Long siteId, Long requestId, AppUserDetails actor) { assertCanManage(siteId, actor); com.example.fixflow.domain.SubsiteRequest alert = alerts.findById(requestId).filter(item -> item.getSite().getId().equals(siteId)).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND.value(), "Subsite request not found")); alert.setStatus(Status.resolved); alert.setResolvedAt(Instant.now()); return SubsiteAlertResponse.from(alert); }
    private Site site(Long id) { return sites.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND.value(), "Site not found")); }
    private User user(Long id) { return users.findById(id).orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED.value(), "User not found")); }
    private void assertCanView(Long siteId, AppUserDetails actor) { if (actor.getRole() == UserRole.super_admin || (actor.getSiteId() != null && actor.getSiteId().equals(siteId))) return; throw new ApiException(HttpStatus.FORBIDDEN.value(), "Not allowed to access this site"); }
    private void assertCanManage(Long siteId, AppUserDetails actor) { if (actor.getRole() == UserRole.super_admin || (actor.getRole() == UserRole.admin && actor.getSiteId() != null && actor.getSiteId().equals(siteId))) return; throw new ApiException(HttpStatus.FORBIDDEN.value(), "Only this site's admin can manage subsites"); }
}
