package com.example.fixflow.service;

import com.example.fixflow.domain.MarketplaceApplication;
import com.example.fixflow.audit.MarketplaceAudit;
import com.example.fixflow.domain.MarketplaceListing;
import com.example.fixflow.repository.MarketplaceApplicationRepository;
import com.example.fixflow.audit.MarketplaceAuditRepository;
import com.example.fixflow.repository.MarketplaceListingRepository;
import java.time.Instant;
import java.util.List;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

public record MarketplaceAssignmentReplaced(Long reportId, Long actorId) {
    @Component
    public static class Listener {
        private final MarketplaceListingRepository listings;
        private final MarketplaceApplicationRepository applications;
        private final MarketplaceAuditRepository audits;

        public Listener(MarketplaceListingRepository listings, MarketplaceApplicationRepository applications,
                MarketplaceAuditRepository audits) {
            this.listings = listings;
            this.applications = applications;
            this.audits = audits;
        }

        @EventListener
        public void retire(MarketplaceAssignmentReplaced event) {
            var assigned = listings.findByReport_IdAndStatusIn(event.reportId(),
                    List.of(MarketplaceListing.Status.assigned));
            for (var listing : assigned) {
                listing.setStatus(MarketplaceListing.Status.closed);
                for (var application : applications.findByListing_IdOrderByIdAsc(listing.getId())) {
                    if (application.getStatus() == MarketplaceApplication.Status.accepted) {
                        application.setStatus(MarketplaceApplication.Status.cancelled);
                        audits.save(new MarketplaceAudit(listing.getId(), application.getId(),
                                event.actorId(), "assignment_replaced", Instant.now()));
                    }
                }
            }
        }
    }
}
