package com.example.fixflow.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.fixflow.domain.SiteRule;
import com.example.fixflow.domain.SiteType;

public interface SiteRuleRepository extends JpaRepository<SiteRule, Long> {

	List<SiteRule> findBySiteTypeOrderBySortOrderAsc(SiteType siteType);

	Optional<SiteRule> findBySiteTypeAndCategory(SiteType siteType, String category);

	boolean existsBySiteTypeAndCategory(SiteType siteType, String category);
}
