package com.example.fixflow.repository;

import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.example.fixflow.domain.TechnicianContract;

public interface TechnicianContractRepository extends JpaRepository<TechnicianContract, Long> {

	boolean existsByTechnician_IdAndSite_Id(Long technicianId, Long siteId);

	@Query("select c from TechnicianContract c join fetch c.site where c.technician.id in :technicianIds order by c.id")
	List<TechnicianContract> findByTechnicianIdsWithSite(@Param("technicianIds") Collection<Long> technicianIds);
}
