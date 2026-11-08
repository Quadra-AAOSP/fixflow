package com.example.fixflow.repository;

import com.example.fixflow.domain.MarketplaceListing;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MarketplaceListingRepository extends JpaRepository<MarketplaceListing, Long> {
    @Query("select l from MarketplaceListing l join fetch l.report r where r.site.id = :siteId order by l.id desc")
    List<MarketplaceListing> findByReport_Site_IdOrderByIdDesc(@Param("siteId") Long siteId);
    List<MarketplaceListing> findByReport_IdAndStatusIn(Long reportId, Collection<MarketplaceListing.Status> statuses);

    @Query("""
            select l from MarketplaceListing l join fetch l.report
            where l.status in ('open', 'offered') or exists
                (select a.id from MarketplaceApplication a where a.listing.id = l.id and a.technician.id = :technicianId)
            order by l.id desc
            """)
    List<MarketplaceListing> findForTechnician(@Param("technicianId") Long technicianId);

    @Query("select l.report.id from MarketplaceListing l where l.id = :id")
    Optional<Long> findReportId(@Param("id") Long id);
}
