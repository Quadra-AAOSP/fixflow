package com.example.fixflow.repository;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import com.example.fixflow.domain.SubsiteRequest;
public interface SubsiteRequestRepository extends JpaRepository<SubsiteRequest, Long> {
    List<SubsiteRequest> findBySite_IdAndStatusOrderByCreatedAtAsc(Long siteId, SubsiteRequest.Status status);
    boolean existsBySite_IdAndRequestedBy_IdAndStatus(Long siteId, Long userId, SubsiteRequest.Status status);
}
