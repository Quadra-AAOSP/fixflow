package com.example.fixflow.service;

import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.example.fixflow.domain.TechnicianContract;
import com.example.fixflow.domain.TechnicianContractApplication;
import com.example.fixflow.domain.User;
import com.example.fixflow.domain.UserRole;
import com.example.fixflow.dto.ContractApplicationRequest;
import com.example.fixflow.dto.ContractApplicationResponse;
import com.example.fixflow.dto.ContractDecisionRequest;
import com.example.fixflow.repository.SiteRepository;
import com.example.fixflow.repository.TechnicianContractApplicationRepository;
import com.example.fixflow.repository.TechnicianContractRepository;
import com.example.fixflow.repository.UserRepository;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.web.ApiException;

@Service
public class ContractApplicationService {
    private final TechnicianContractApplicationRepository applications;
    private final TechnicianContractRepository contracts;
    private final UserRepository users;
    private final SiteRepository sites;

    public ContractApplicationService(TechnicianContractApplicationRepository applications,
            TechnicianContractRepository contracts, UserRepository users, SiteRepository sites) {
        this.applications = applications;
        this.contracts = contracts;
        this.users = users;
        this.sites = sites;
    }

    @Transactional
    public ContractApplicationResponse request(ContractApplicationRequest request, AppUserDetails actor) {
        if (actor.getRole() != UserRole.technician) throw new ApiException(403, "Only technicians can request contracts");
        if (contracts.existsByTechnician_IdAndSite_Id(actor.getId(), request.siteId())) {
            throw new ApiException(409, "Contract already exists");
        }
        if (applications.existsByTechnician_IdAndSite_Id(actor.getId(), request.siteId())) {
            throw new ApiException(409, "A request already exists for this site");
        }
        TechnicianContractApplication application = new TechnicianContractApplication();
        User technician = users.findById(actor.getId()).orElseThrow(() -> new ApiException(401, "User not found"));
        if (technician.getRole() != UserRole.technician) throw new ApiException(403, "Only technicians can request contracts");
        application.setTechnician(technician);
        application.setSite(sites.findById(request.siteId()).orElseThrow(() -> new ApiException(404, "Site not found")));
        application.setNote(request.note());
        return ContractApplicationResponse.from(applications.saveAndFlush(application));
    }

    @Transactional(readOnly = true)
    public List<ContractApplicationResponse> list(Long siteId, AppUserDetails actor) {
        if (actor.getRole() == UserRole.technician) {
            return applications.findByTechnician_IdOrderByCreatedAtDesc(actor.getId()).stream()
                    .filter(a -> siteId == null || a.getSite().getId().equals(siteId))
                    .map(ContractApplicationResponse::from).toList();
        }
        Long target = siteId == null ? actor.getSiteId() : siteId;
        requireSiteAdmin(target, actor);
        return applications.findBySite_IdOrderByCreatedAtDesc(target).stream()
                .map(ContractApplicationResponse::from).toList();
    }

    @Transactional
    public ContractApplicationResponse decide(Long id, ContractDecisionRequest decision, AppUserDetails actor) {
        if (actor.getRole() != UserRole.admin) throw new ApiException(403, "Only the target site admin can decide requests");
        TechnicianContractApplication application = applications.lockById(id)
                .orElseThrow(() -> new ApiException(404, "Contract request not found"));
        requireSiteAdmin(application.getSite().getId(), actor);
        if (application.getStatus() != TechnicianContractApplication.Status.pending) {
            throw new ApiException(409, "Request has already been decided");
        }
        if (decision.decision() == ContractDecisionRequest.Decision.approve) {
            if (application.getTechnician().getRole() != UserRole.technician) {
                throw new ApiException(409, "Requester is no longer a technician");
            }
            if (!contracts.existsByTechnician_IdAndSite_Id(application.getTechnician().getId(), application.getSite().getId())) {
                TechnicianContract contract = new TechnicianContract();
                contract.setTechnician(application.getTechnician());
                contract.setSite(application.getSite());
                contracts.saveAndFlush(contract);
            }
            application.setStatus(TechnicianContractApplication.Status.approved);
        } else {
            application.setStatus(TechnicianContractApplication.Status.rejected);
        }
        application.setDecisionReason(decision.reason());
        application.setDecidedBy(users.findById(actor.getId()).orElseThrow(() -> new ApiException(401, "User not found")));
        application.setDecidedAt(Instant.now());
        return ContractApplicationResponse.from(application);
    }

    private void requireSiteAdmin(Long siteId, AppUserDetails actor) {
        if (siteId == null || actor.getRole() != UserRole.admin || !siteId.equals(actor.getSiteId())) {
            throw new ApiException(403, "Only the target site admin can access requests");
        }
    }
}
