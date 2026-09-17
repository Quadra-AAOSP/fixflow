package com.example.fixflow.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.example.fixflow.domain.Report;

public interface ReportRepository extends JpaRepository<Report, Long> {

	@Query("""
			select r from Report r
			join fetch r.site
			join fetch r.createdBy
			left join fetch r.assignedTechnician
			where r.site.id = :siteId
			order by r.createdAt desc
			""")
	List<Report> findDetailedBySiteId(@Param("siteId") Long siteId);

	@Query("""
			select r from Report r
			join fetch r.site
			join fetch r.createdBy
			left join fetch r.assignedTechnician
			where r.id = :id
			""")
	Optional<Report> findDetailedById(@Param("id") Long id);
}
