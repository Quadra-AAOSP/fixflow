package com.example.fixflow.repository;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import com.example.fixflow.domain.Subsite;
public interface SubsiteRepository extends JpaRepository<Subsite, Long> {
    List<Subsite> findBySite_IdOrderByLabelAsc(Long siteId);
    boolean existsBySite_IdAndLabelIgnoreCase(Long siteId, String label);
}
