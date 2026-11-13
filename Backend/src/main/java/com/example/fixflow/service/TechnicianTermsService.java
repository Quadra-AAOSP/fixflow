package com.example.fixflow.service;

import java.time.Instant;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.example.fixflow.domain.TechnicianTermsAcceptance;
import com.example.fixflow.domain.UserRole;
import com.example.fixflow.repository.TechnicianContractApplicationRepository;
import com.example.fixflow.repository.TechnicianContractRepository;
import com.example.fixflow.repository.TechnicianTermsAcceptanceRepository;
import com.example.fixflow.repository.UserRepository;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.web.ApiException;

@Service
public class TechnicianTermsService {
    public record CurrentTerms(String currentVersion, String documentUrl) { }
    public CurrentTerms currentTerms() {
        return new CurrentTerms(version.isEmpty() ? null : version, documentUrl.isEmpty() ? null : documentUrl);
    }
    public record Acceptance(String version, String documentUrl, Instant acceptedAt) { }
    public record Status(Long technicianId, String currentVersion, String documentUrl,
            boolean enforcementRequired, boolean acceptedCurrentVersion, List<Acceptance> acceptances) { }
    private final TechnicianTermsAcceptanceRepository acceptances;
    private final UserRepository users;
    private final TechnicianContractRepository contracts;
    private final TechnicianContractApplicationRepository applications;
    private final String version;
    private final String documentUrl;
    private final boolean required;

    public TechnicianTermsService(TechnicianTermsAcceptanceRepository acceptances, UserRepository users,
            TechnicianContractRepository contracts, TechnicianContractApplicationRepository applications,
            @Value("${fixflow.technician-terms.version:}") String version,
            @Value("${fixflow.technician-terms.document-url:}") String documentUrl,
            @Value("${fixflow.technician-terms.required:false}") boolean required) {
        this.acceptances = acceptances; this.users = users; this.contracts = contracts; this.applications = applications;
        this.version = version.trim(); this.documentUrl = documentUrl.trim(); this.required = required;
        if (this.version.length() > 64 || this.documentUrl.length() > 1024
                || (required && (this.version.isEmpty() || this.documentUrl.isEmpty()))) {
            throw new IllegalArgumentException("Required technician terms need a version (max 64) and document URL (max 1024)");
        }
    }

    @Transactional(readOnly = true)
    public void requireAcceptance(Long technicianId) {
        if (!permitsWork(technicianId)) {
            throw new ApiException(409, "Technician must accept the current terms version before working or requesting a contract");
        }
    }

    @Transactional(readOnly = true)
    public boolean permitsWork(Long technicianId) {
        return !version.isEmpty() && !documentUrl.isEmpty() && acceptances.existsByTechnician_IdAndTermsVersion(technicianId, version);
    }

    @Transactional
    public Status accept(String requestedVersion, AppUserDetails actor) {
        if (actor.getRole() != UserRole.technician) throw new ApiException(403, "Only technicians can accept technician terms");
        var technician = users.findById(actor.getId()).orElseThrow(() -> new ApiException(401, "User not found"));
        if (technician.getRole() != UserRole.technician) throw new ApiException(403, "Only technicians can accept technician terms");
        recordAcceptance(technician, requestedVersion);
        return status(actor.getId(), actor);
    }

    /** Records acceptance for a newly registered technician (no session principal yet). */
    @Transactional
    public void recordAcceptance(com.example.fixflow.domain.User technician, String requestedVersion) {
        if (version.isEmpty() || documentUrl.isEmpty()) {
            throw new ApiException(503, "Approved technician terms are not configured");
        }
        if (!version.equals(requestedVersion)) {
            throw new ApiException(409, "Terms version changed; review and accept the current version");
        }
        if (technician.getRole() != UserRole.technician) {
            throw new ApiException(403, "Only technicians can accept technician terms");
        }
        if (!acceptances.existsByTechnician_IdAndTermsVersion(technician.getId(), version)) {
            TechnicianTermsAcceptance acceptance = new TechnicianTermsAcceptance();
            acceptance.setTechnician(technician);
            acceptance.setTermsVersion(version);
            acceptance.setDocumentUrl(documentUrl);
            acceptances.saveAndFlush(acceptance);
        }
    }

    @Transactional(readOnly = true)
    public Status status(Long technicianId, AppUserDetails actor) {
        boolean self = actor.getRole() == UserRole.technician && actor.getId().equals(technicianId);
        boolean siteAdmin = actor.getRole() == UserRole.admin && actor.getSiteId() != null
                && (contracts.existsByTechnician_IdAndSite_Id(technicianId, actor.getSiteId())
                || applications.existsByTechnician_IdAndSite_Id(technicianId, actor.getSiteId()));
        if (!self && !siteAdmin && actor.getRole() != UserRole.super_admin) throw new ApiException(403, "Not allowed to view technician terms status");
        var technician = users.findById(technicianId).orElseThrow(() -> new ApiException(404, "Technician not found"));
        if (technician.getRole() != UserRole.technician) throw new ApiException(400, "User is not a technician");
        List<Acceptance> history = acceptances.findByTechnician_IdOrderByAcceptedAtDesc(technicianId).stream()
                .map(a -> new Acceptance(a.getTermsVersion(), a.getDocumentUrl(), a.getAcceptedAt())).toList();
        return new Status(technicianId, version.isEmpty() ? null : version, documentUrl.isEmpty() ? null : documentUrl,
                true, !version.isEmpty() && !documentUrl.isEmpty() && history.stream().anyMatch(a -> a.version().equals(version)), history);
    }
}

