package com.example.fixflow.service;

import com.example.fixflow.domain.*;
import com.example.fixflow.dto.ReportResponse;
import com.example.fixflow.repository.*;
import com.example.fixflow.security.AppUserDetails;
import com.example.fixflow.web.ApiException;
import com.example.fixflow.realtime.ReportDomainEvent;
import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.context.ApplicationEventPublisher;

@Service
@Transactional
public class ReportWorkflowService {
    private final ReportRepository reports;
    private final UserRepository users;
    private final TechnicianContractRepository contracts;
    private final ReportReporterRepository participants;
    private final StatusHistoryRepository history;
    private final ReportResolutionRepository resolutions;
    private final ReportNotificationRepository notifications;
    private final ReportRatingRepository ratings;
    private final ReportLinkRepository links;
    private final TechnicianTermsService terms;
    private final SiteVettingService vetting;
    private final ReportService reportService;
    private final ApplicationEventPublisher events;

    public ReportWorkflowService(ReportRepository reports, UserRepository users,
            TechnicianContractRepository contracts, ReportReporterRepository participants,
            StatusHistoryRepository history, ReportResolutionRepository resolutions,
            ReportRatingRepository ratings, ReportLinkRepository links, TechnicianTermsService terms,
            ReportService reportService, ApplicationEventPublisher events, ReportNotificationRepository notifications, SiteVettingService vetting) {
        this.vetting=vetting;
        this.reports=reports; this.users=users; this.contracts=contracts; this.participants=participants;
        this.history=history; this.resolutions=resolutions; this.ratings=ratings; this.links=links;
        this.terms=terms; this.reportService=reportService; this.events=events; this.notifications=notifications;
    }

    public ReportResponse claim(Long id, AppUserDetails actor) {
        if(actor.getRole()!=UserRole.technician) denied();
        Report report=locked(id);
        if(!contracts.existsByTechnician_IdAndSite_Id(actor.getId(),report.getSite().getId())) denied();
        vetting.requireEligible(actor.getId(), report.getSite().getId());
        if(report.getAssignedTechnician()!=null || !List.of(ReportStatus.open,ReportStatus.routed,
                ReportStatus.reopened,ReportStatus.escalated).contains(report.getStatus())) conflict("Report is not claimable");
        activateAssignment(report,actor(actor),actor,"Technician claimed report");
        return reportService.get(id,actor);
    }

    void activateMarketplaceAssignment(Report report, User technician, AppUserDetails actor) {
        activateAssignment(report,technician,actor,"Technician accepted marketplace offer");
    }

    void cancelMarketplaceAssignment(Report report, AppUserDetails actor, String reason) {
        Long former = report.getAssignedTechnician().getId();
        ReportStatus from = report.getStatus();
        ReportStatus to = report.getReopenCount() > 0 ? ReportStatus.reopened : ReportStatus.open;
        report.setAssignedTechnician(null);
        report.setStatus(to);
        report.setConfirmedAt(null);
        report.setConfirmedBy(null);
        audit(report, from, to, actor, "Marketplace assignment cancelled: " + reason);
        events.publishEvent(ReportDomainEvent.of(ReportDomainEvent.REASSIGNMENT, report.getSite().getId(),
                report.getId(), from, to, former, null));
    }

    private void activateAssignment(Report report, User technician, AppUserDetails actor, String reason) {
        report.setAssignedTechnician(technician);
        transition(report,ReportStatus.assigned,actor,reason,ReportDomainEvent.ASSIGNMENT);
    }

    public ReportResponse start(Long id, AppUserDetails actor) {
        Report report=locked(id); assigned(report,actor); vetting.requireEligible(actor.getId(), report.getSite().getId());
        if(!List.of(ReportStatus.assigned,ReportStatus.reopened,ReportStatus.escalated).contains(report.getStatus()))
            conflict("Report cannot start from its current status");
        transition(report,ReportStatus.in_progress,actor,"Work started",ReportDomainEvent.STATUS_CHANGE);
        return reportService.get(id,actor);
    }

    public ReportResponse resolve(Long id,String description,AppUserDetails actor) {
        Report report=locked(id); assigned(report,actor); terms.requireAcceptance(actor.getId());
        if(report.getStatus()!=ReportStatus.in_progress) conflict("Only work in progress can be resolved");
        ReportResolution resolution=new ReportResolution(); resolution.setReport(report);
        resolution.setTechnician(actor(actor)); resolution.setDescription(description.trim()); resolutions.save(resolution);
        transition(report,ReportStatus.resolved_pending_confirmation,actor,"Resolution submitted",ReportDomainEvent.PENDING_RESOLUTION);
        notifications.save(new ReportNotification(report.getCreatedBy().getId(), report.getId(), ReportNotification.Type.work_completed, Instant.now()));
        return reportService.get(id,actor);
    }

    public ReportResponse escalate(Long id,String reason,AppUserDetails actor) {
        Report report=locked(id); view(report,actor);
        boolean technician=actor.getRole()==UserRole.technician;
        if(technician) assigned(report,actor); else operator(report,actor);
        if(List.of(ReportStatus.confirmed,ReportStatus.resolved_pending_confirmation,ReportStatus.escalated).contains(report.getStatus()))
            conflict("Report cannot be escalated from its current status");
        transition(report,ReportStatus.escalated,actor,reason.trim(),ReportDomainEvent.STATUS_CHANGE);
        return reportService.get(id,actor);
    }

    public ReportResponse urgency(Long id,Urgency urgency,String reason,AppUserDetails actor) {
        Report report=locked(id); operator(report,actor);
        if(report.getStatus()==ReportStatus.confirmed) conflict("Confirmed report cannot change urgency");
        Urgency previous=report.getFinalUrgency(); report.setFinalUrgency(urgency);
        audit(report,report.getStatus(),report.getStatus(),actor,"Urgency override: "+previous+" -> "+urgency+"; "+reason.trim());
        return reportService.get(id,actor);
    }

    public record HistoryItem(Long id,String fromStatus,String toStatus,Long changedByUserId,String note,Instant createdAt) { }
    @Transactional(readOnly=true)
    public List<HistoryItem> history(Long id,AppUserDetails actor) {
        Report report=found(id);
        boolean sensitive=reportService.get(id,actor).policy().canSeeSensitive();
        return history.findByReport_IdOrderByCreatedAtAsc(id).stream().map(h->new HistoryItem(h.getId(),
                h.getFromStatus(),h.getToStatus(),sensitive?h.getChangedBy().getId():null,
                sensitive?h.getNote():null,h.getCreatedAt())).toList();
    }
    public record ResolutionItem(Long id,Long technicianId,String description,Instant createdAt) { }
    @Transactional(readOnly=true)
    public List<ResolutionItem> resolutions(Long id,AppUserDetails actor) {
        view(found(id),actor);
        return resolutions.findByReport_IdOrderByIdAsc(id).stream().map(r->new ResolutionItem(r.getId(),
                r.getTechnician().getId(),r.getDescription(),r.getCreatedAt())).toList();
    }
    public record RatingItem(Long id,Long resolutionId,int score,String feedback,Instant createdAt,
            boolean ratedByCurrentUser) { }
    public RatingItem rate(Long id,Long resolutionId,int score,String feedback,AppUserDetails actor) {
        Report report=locked(id); view(report,actor);
        if(actor.getRole()==UserRole.technician) denied();
        if(actor.getRole()==UserRole.reporter && !report.getCreatedBy().getId().equals(actor.getId())
                && !participants.existsByReportIdAndUserId(id,actor.getId())) denied();
        if(actor.getRole()!=UserRole.reporter) operator(report,actor);
        if(report.getStatus()!=ReportStatus.confirmed) conflict("Ratings require a confirmed resolution");
        ReportResolution resolution=resolutions.findById(resolutionId).filter(r->r.getReport().getId().equals(id))
                .orElseThrow(()->new ApiException(404,"Resolution not found"));
        if(resolution.getTechnician().getId().equals(actor.getId())) denied();
        if(ratings.existsByResolution_IdAndRatedBy_Id(resolutionId,actor.getId())) conflict("Resolution already rated by this user");
        ReportRating rating=new ReportRating(); rating.setResolution(resolution); rating.setRatedBy(actor(actor));
        rating.setScore(score); rating.setFeedback(feedback==null?null:feedback.trim()); ratings.saveAndFlush(rating);
        return rating(rating,actor);
    }
    @Transactional(readOnly=true)
    public List<RatingItem> ratings(Long id,AppUserDetails actor) {
        view(found(id),actor);
        return ratings.findByResolution_Report_IdOrderByIdAsc(id).stream().map(value->rating(value,actor)).toList();
    }
    private RatingItem rating(ReportRating value,AppUserDetails actor) {
        return new RatingItem(value.getId(),value.getResolution().getId(),value.getScore(),value.getFeedback(),
                value.getCreatedAt(),value.getRatedBy().getId().equals(actor.getId()));
    }
    public record LinkItem(Long id,Long reportId,Long linkedReportId,String reason,Instant createdAt) { }
    public LinkItem link(Long id,Long target,String reason,AppUserDetails actor) {
        if(id.equals(target)) conflict("A report cannot link to itself");
        // Consistent lock order prevents opposing link requests deadlocking.
        Report first=locked(Math.min(id,target)); Report second=locked(Math.max(id,target));
        Report source=first.getId().equals(id)?first:second;
        Report destination=first.getId().equals(target)?first:second;
        view(source,actor); view(destination,actor); operator(source,actor);
        if(!source.getSite().getId().equals(destination.getSite().getId())) denied();
        if(links.existsByReport_IdAndLinkedReport_Id(id,target) || links.existsByReport_IdAndLinkedReport_Id(target,id))
            conflict("Reports are already linked");
        ReportLink link=new ReportLink(); link.setReport(source); link.setLinkedReport(destination);
        link.setCreatedBy(actor(actor)); link.setReason(reason.trim()); links.saveAndFlush(link);
        return link(link);
    }
    @Transactional(readOnly=true)
    public List<LinkItem> links(Long id,AppUserDetails actor) {
        view(found(id),actor);
        return links.findByReport_IdOrLinkedReport_IdOrderByIdAsc(id,id).stream()
                .filter(l->reportService.canRead(l.getReport().getId(),actor)
                        && reportService.canRead(l.getLinkedReport().getId(),actor))
                .map(this::link).toList();
    }
    private LinkItem link(ReportLink value) {return new LinkItem(value.getId(),value.getReport().getId(),
            value.getLinkedReport().getId(),value.getReason(),value.getCreatedAt());}
    private Report locked(Long id) {return reports.findForVisionUpdate(id).orElseThrow(()->new ApiException(404,"Report not found"));}
    private Report found(Long id) {return reports.findById(id).orElseThrow(()->new ApiException(404,"Report not found"));}
    private User actor(AppUserDetails actor) {return users.findById(actor.getId()).orElseThrow(()->new ApiException(401,"User not found"));}
    private void assigned(Report report,AppUserDetails actor) {
        if(actor.getRole()!=UserRole.technician || report.getAssignedTechnician()==null
                || !report.getAssignedTechnician().getId().equals(actor.getId())) denied();
    }
    private void operator(Report report,AppUserDetails actor) {
        if(actor.getRole()!=UserRole.staff && actor.getRole()!=UserRole.admin && actor.getRole()!=UserRole.super_admin) denied();
        view(report,actor);
    }
    private void view(Report report,AppUserDetails actor) {reportService.get(report.getId(),actor);}
    private void transition(Report report,ReportStatus to,AppUserDetails actor,String note,String eventType) {
        ReportStatus from=report.getStatus(); report.setStatus(to); report.setConfirmedAt(null); report.setConfirmedBy(null); report.setConfirmationSignedName(null);
        audit(report,from,to,actor,note);
        Long technician=report.getAssignedTechnician()==null?null:report.getAssignedTechnician().getId();
        events.publishEvent(ReportDomainEvent.of(eventType,report.getSite().getId(),report.getId(),from,to,
                eventType.equals(ReportDomainEvent.ASSIGNMENT)?null:technician,technician));
    }
    private void audit(Report report,ReportStatus from,ReportStatus to,AppUserDetails actor,String note) {
        StatusHistory item=new StatusHistory(); item.setReport(report); item.setFromStatus(from.name());
        item.setToStatus(to.name()); item.setChangedBy(actor(actor)); item.setNote(note); history.save(item);
    }
    private void denied(){throw new ApiException(403,"Not authorized for this report action");}
    private void conflict(String message){throw new ApiException(409,message);}
}
