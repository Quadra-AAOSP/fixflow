package com.example.fixflow.repository;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import com.example.fixflow.domain.SiteTechnicianVetting;
public interface SiteTechnicianVettingRepository extends JpaRepository<SiteTechnicianVetting, Long> {
 Optional<SiteTechnicianVetting> findFirstBySiteIdAndTechnicianIdOrderByIdDesc(Long siteId, Long technicianId);
}
