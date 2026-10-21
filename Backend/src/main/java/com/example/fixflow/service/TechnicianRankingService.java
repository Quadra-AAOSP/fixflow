package com.example.fixflow.service;

import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.example.fixflow.domain.*;
import com.example.fixflow.repository.*;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.web.ApiException;

@Service
public class TechnicianRankingService {
    public enum Mode { STANDARD, AI }
    public record Candidate(Long technicianId, int proficiency, boolean specialtyMatch,
            long activeCases, double score) { }
    public record Result(Long reportId, Mode requestedMode, Mode methodUsed, String fallbackReason,
            List<Candidate> candidates) { }
    private static final List<ReportStatus> ACTIVE = List.of(ReportStatus.assigned,
            ReportStatus.in_progress, ReportStatus.reopened, ReportStatus.escalated);
    private final ReportRepository reports;
    private final TechnicianContractRepository contracts;
    private final TechnicianSkillRepository skills;
    private final TechnicianAvailabilityRepository availability;
    private final TechnicianTermsService terms;

    public TechnicianRankingService(ReportRepository reports, TechnicianContractRepository contracts,
            TechnicianSkillRepository skills, TechnicianAvailabilityRepository availability,
            TechnicianTermsService terms) {
        this.reports = reports; this.contracts = contracts; this.skills = skills;
        this.availability = availability; this.terms = terms;
    }

    @Transactional(readOnly = true)
    public Result rank(Long reportId, Mode mode, AppUserDetails actor) {
        if (actor.getRole() != UserRole.admin && actor.getRole() != UserRole.super_admin) {
            throw new ApiException(403, "Only site admins or super admins may rank technicians");
        }
        Report report = reports.findDetailedById(reportId).orElseThrow(() -> new ApiException(404, "Report not found"));
        Long siteId = report.getSite().getId();
        if (actor.getRole() != UserRole.super_admin && !siteId.equals(actor.getSiteId())) {
            throw new ApiException(403, "Cannot rank technicians for another site");
        }
        List<Candidate> candidates = new java.util.ArrayList<>();
        for (TechnicianContract contract : contracts.findBySite_Id(siteId)) {
            User technician = contract.getTechnician();
            if (technician.getRole() != UserRole.technician || !availability.findById(technician.getId())
                    .map(a -> a.getStatus() == AvailabilityStatus.available).orElse(false)) continue;
            try { terms.requireAcceptance(technician.getId()); }
            catch (ApiException e) { if (e.getStatus() == 409) continue; throw e; }
            var matching = skills.findByTechnician_IdAndCategoryIgnoreCase(technician.getId(), report.getCategory())
                    .stream().filter(s -> s.getProficiency() >= 1 && s.getProficiency() <= 5)
                    .filter(s -> report.getSpecialty() == null || report.getSpecialty().isBlank()
                            || report.getSpecialty().equalsIgnoreCase(s.getSpecialty())).toList();
            int proficiency = matching.stream().mapToInt(TechnicianSkill::getProficiency).max().orElse(0);
            if (proficiency == 0) continue;
            boolean specialtyMatch = report.getSpecialty() != null && !report.getSpecialty().isBlank();
            long active = reports.countByAssignedTechnician_IdAndSite_IdAndStatusIn(technician.getId(), siteId, ACTIVE);
            double score = 50 + (specialtyMatch ? 20 : 0) + proficiency * 5 + 25.0 / (1 + active);
            candidates.add(new Candidate(technician.getId(), proficiency, specialtyMatch, active, score));
        }
        candidates.sort(Comparator.comparingDouble(Candidate::score).reversed()
                .thenComparingLong(Candidate::activeCases).thenComparing(Candidate::technicianId));
        return new Result(reportId, mode, Mode.STANDARD,
                mode == Mode.AI ? "AI ranking is not configured; deterministic ranking used" : null,
                List.copyOf(candidates));
    }
}
