package com.example.fixflow.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.example.fixflow.domain.Report;
import com.example.fixflow.domain.ReportStatus;

public interface ReportRepository extends JpaRepository<Report, Long> {

	@Query("""
			select r from Report r
			join fetch r.site
			join fetch r.createdBy
			left join fetch r.assignedTechnician
			left join fetch r.subsite
			where r.site.id = :siteId
			order by r.createdAt desc
			""")
	List<Report> findDetailedBySiteId(@Param("siteId") Long siteId);

	@Query("""
			select r from Report r
			join fetch r.site
			join fetch r.createdBy
			left join fetch r.assignedTechnician
			left join fetch r.subsite
			where r.id = :id
			""")
	Optional<Report> findDetailedById(@Param("id") Long id);

	@Query(
			value = """
					select r from Report r
					join r.site s
					left join SiteRule rule on rule.siteType = s.type and rule.category = r.category
					where s.id = :siteId
					  and r.status <> :confirmed
					  and (:category is null or r.category = :category)
					order by coalesce(rule.urgencyWeight, 0) desc, r.createdAt desc
					""",
			countQuery = """
					select count(r) from Report r
					join r.site s
					where s.id = :siteId
					  and r.status <> :confirmed
					  and (:category is null or r.category = :category)
					"""
	)
	Page<Report> findOpenBySite(
			@Param("siteId") Long siteId,
			@Param("category") String category,
			@Param("confirmed") ReportStatus confirmed,
			Pageable pageable
	);

	@Query("""
			select r from Report r
			join fetch r.site
			join fetch r.createdBy
			left join fetch r.assignedTechnician
			left join fetch r.subsite
			where r.id in :ids
			""")
	List<Report> findDetailedByIdIn(@Param("ids") List<Long> ids);
}
