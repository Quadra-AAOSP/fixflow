package com.example.fixflow.repository;

import com.example.fixflow.domain.MarketplaceApplication;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MarketplaceApplicationRepository extends JpaRepository<MarketplaceApplication, Long> {
    List<MarketplaceApplication> findByListing_IdOrderByIdAsc(Long listingId);
    Optional<MarketplaceApplication> findByListing_IdAndTechnician_Id(Long listingId, Long technicianId);
    Optional<MarketplaceApplication> findByIdAndListing_Id(Long id, Long listingId);
    long countByTechnician_IdAndStatus(Long technicianId, MarketplaceApplication.Status status);
}
