package com.example.fixflow.service;

import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Service;
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
    private final org.springframework.beans.factory.ObjectProvider<com.example.fixflow.ai.TechnicianRankingProvider> provider;
    private final TechnicianRankingAuditRepository audits;
    private final org.springframework.transaction.support.TransactionTemplate transactions;
    private record Snapshot(String category, String specialty, List<Candidate> candidates) { }

    public TechnicianRankingService(ReportRepository reports, TechnicianContractRepository contracts,
            TechnicianSkillRepository skills, TechnicianAvailabilityRepository availability,
            TechnicianTermsService terms,
            org.springframework.beans.factory.ObjectProvider<com.example.fixflow.ai.TechnicianRankingProvider> provider,
            TechnicianRankingAuditRepository audits, org.springframework.transaction.PlatformTransactionManager manager) {
        this.reports = reports; this.contracts = contracts; this.skills = skills;
        this.availability = availability; this.terms = terms;
        this.provider = provider; this.audits = audits;
        this.transactions = new org.springframework.transaction.support.TransactionTemplate(manager);
    }

    public Result rank(Long reportId, Mode mode, AppUserDetails actor) {
        Snapshot initial = transactions.execute(status -> eligible(reportId, actor));
        List<Candidate> result = initial.candidates();
        Mode method = Mode.STANDARD;
        String fallback = null;
        if (mode == Mode.AI) {
            var ai = provider.getIfAvailable();
            if (ai == null) fallback = "AI ranking is not configured; deterministic ranking used";
            else if (result.size() < 2 || result.size() > 50) fallback = "AI ranking requires 2-50 eligible candidates";
            else {
                List<Integer> order = null;
                try {
                    List<com.example.fixflow.ai.TechnicianRankingProvider.Candidate> inputs = new java.util.ArrayList<>();
                    for (int i = 0; i < result.size(); i++) {
                        Candidate c = result.get(i);
                        inputs.add(new com.example.fixflow.ai.TechnicianRankingProvider.Candidate(
                                i, c.proficiency(), c.specialtyMatch(), c.activeCases()));
                    }
                    // Normal API calls have no database transaction held during this network operation.
                    order = ai.rank(initial.category(), initial.specialty(), inputs);
                } catch (Exception failure) { fallback = "AI provider failed; deterministic ranking used"; }
                Snapshot current = transactions.execute(status -> eligible(reportId, actor));
                result = current.candidates();
                if (!initial.equals(current)) fallback = "Eligibility or workload changed; deterministic ranking used";
                else if (order == null || order.size() != result.size()
                        || new java.util.HashSet<>(order).size() != result.size()
                        || order.stream().anyMatch(slot -> slot == null || slot < 0 || slot >= initial.candidates().size())) {
                    if (fallback == null) fallback = "Invalid AI candidate order; deterministic ranking used";
                } else {
                    final List<Candidate> currentCandidates = result;
                    result = order.stream().map(currentCandidates::get).toList(); method = Mode.AI;
                }
            }
        }
        Result response = new Result(reportId, mode, method, fallback, List.copyOf(result));
        transactions.executeWithoutResult(status -> {
            TechnicianRankingAudit audit = new TechnicianRankingAudit();
            audit.setReportId(reportId); audit.setActorId(actor.getId()); audit.setRequestedMode(mode.name());
            audit.setMethodUsed(response.methodUsed().name()); audit.setFallbackReason(response.fallbackReason());
            audit.setTechnicianOrder(response.candidates().stream().map(c -> c.technicianId().toString())
                    .collect(java.util.stream.Collectors.joining(",")));
            audit.setCreatedAt(java.time.Instant.now()); audits.save(audit);
        });
        return response;
    }

    private Snapshot eligible(Long reportId, AppUserDetails actor) {
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
        return new Snapshot(report.getCategory(), report.getSpecialty(), List.copyOf(candidates));
    }
}
