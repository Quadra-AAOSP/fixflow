package com.example.fixflow.service;

import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.PageRequest;
import com.example.fixflow.domain.*;
import com.example.fixflow.repository.*;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.web.ApiException;

@Service
public class TechnicianInvitationService {
    public record Invitation(Long id, Long siteId, String category, String specialty, String reason, Instant createdAt) { }
    public record Inbox(List<Invitation> items, int page, boolean hasNext) { }
    public record Sent(int created, int page, boolean hasNext) { }
    private final ReportRepository reports;
    private final UserRepository users;
    private final TechnicianSkillRepository skills;
    private final TechnicianContractRepository contracts;
    private final TechnicianInvitationRepository invitations;
    public TechnicianInvitationService(ReportRepository reports, UserRepository users, TechnicianSkillRepository skills,
            TechnicianContractRepository contracts, TechnicianInvitationRepository invitations) {
        this.reports = reports; this.users = users; this.skills = skills;
        this.contracts = contracts; this.invitations = invitations;
    }
    @Transactional
    public Sent invite(Long id, String reason, int page, AppUserDetails actor) {
        checkPage(page);
        if (actor.getRole() != UserRole.admin && actor.getRole() != UserRole.super_admin) throw new ApiException(403, "Only admins can invite technicians");
        Report report = reports.findForVisionUpdate(id).orElseThrow(() -> new ApiException(404, "Report not found"));
        if (actor.getRole() != UserRole.super_admin && !report.getSite().getId().equals(actor.getSiteId())) throw new ApiException(403, "Cannot invite for another site");
        if (report.getStatus() == ReportStatus.confirmed || report.getStatus() == ReportStatus.resolved_pending_confirmation) throw new ApiException(409, "Report is not awaiting technician work");
        var matches = skills.findByCategoryIgnoreCase(report.getCategory(), PageRequest.of(page, 100, org.springframework.data.domain.Sort.by("id")));
        int created = 0;
        for (TechnicianSkill skill : matches) {
            User technician = skill.getTechnician();
            if (technician.getRole() != UserRole.technician || skill.getProficiency() < 1 || skill.getProficiency() > 5
                    || report.getSpecialty() != null && !report.getSpecialty().isBlank() && !report.getSpecialty().equalsIgnoreCase(skill.getSpecialty())
                    || contracts.existsByTechnician_IdAndSite_Id(technician.getId(), report.getSite().getId())
                    || invitations.existsByReport_IdAndTechnician_Id(id, technician.getId())) continue;
            TechnicianInvitation invitation = new TechnicianInvitation(); invitation.setReport(report);
            invitation.setTechnician(technician); invitation.setInvitedBy(users.getReferenceById(actor.getId()));
            invitation.setReason(reason.trim()); invitations.saveAndFlush(invitation); created++;
        }
        return new Sent(created, page, matches.hasNext());
    }
    @Transactional(readOnly = true)
    public Inbox inbox(int page, AppUserDetails actor) {
        checkPage(page);
        if (actor.getRole() != UserRole.technician) throw new ApiException(403, "Only technicians have a contract-invitation inbox");
        var result = invitations.findByTechnician_IdOrderByCreatedAtDescIdDesc(actor.getId(), PageRequest.of(page, 50));
        return new Inbox(result.stream().map(i -> new Invitation(i.getId(), i.getReport().getSite().getId(),
                i.getReport().getCategory(), i.getReport().getSpecialty(), i.getReason(), i.getCreatedAt())).toList(), page, result.hasNext());
    }
    private void checkPage(int page) { if (page < 0 || page > 10000) throw new ApiException(400, "Page must be between 0 and 10000"); }
}
