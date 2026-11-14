package com.example.fixflow.repository;

import com.example.fixflow.domain.MarketplaceApplication;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MarketplaceApplicationRepository extends JpaRepository<MarketplaceApplication, Long> {
    List<MarketplaceApplication> findByListing_IdOrderByIdAsc(Long listingId);

    @Query("""
            select a from MarketplaceApplication a
            join fetch a.technician
            join fetch a.listing l
            join fetch l.report
            where a.listing.id = :listingId
            order by a.id asc
            """)
    List<MarketplaceApplication> findDetailedByListingId(@Param("listingId") Long listingId);

    @Query("""
            select a from MarketplaceApplication a
            join fetch a.technician
            join fetch a.listing l
            join fetch l.report
            where a.listing.id in :listingIds
            order by a.listing.id asc, a.id asc
            """)
    List<MarketplaceApplication> findDetailedByListingIdIn(@Param("listingIds") Collection<Long> listingIds);

    Optional<MarketplaceApplication> findByListing_IdAndTechnician_Id(Long listingId, Long technicianId);
    Optional<MarketplaceApplication> findByIdAndListing_Id(Long id, Long listingId);
    long countByTechnician_IdAndStatus(Long technicianId, MarketplaceApplication.Status status);
}
