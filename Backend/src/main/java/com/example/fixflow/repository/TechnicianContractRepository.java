package com.example.fixflow.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.example.fixflow.domain.TechnicianContract;

public interface TechnicianContractRepository extends JpaRepository<TechnicianContract, Long> {

	boolean existsByTechnician_IdAndSite_Id(Long technicianId, Long siteId);
    java.util.List<TechnicianContract> findBySite_Id(Long siteId);

	List<TechnicianContract> findBySite_IdOrderByCreatedAtDesc(Long siteId);

	@Query("""
			select c from TechnicianContract c
			join fetch c.technician
			join fetch c.site
			where c.site.id = :siteId
			order by c.createdAt desc
			""")
	List<TechnicianContract> findDetailedBySiteId(@Param("siteId") Long siteId);

	@Query("""
			select c from TechnicianContract c
			join fetch c.technician
			join fetch c.site
			where c.id = :id
			""")
	Optional<TechnicianContract> findDetailedById(@Param("id") Long id);

	@Query("select c from TechnicianContract c join fetch c.site where c.technician.id in :technicianIds order by c.id")
	List<TechnicianContract> findByTechnicianIdsWithSite(@Param("technicianIds") Collection<Long> technicianIds);
}
