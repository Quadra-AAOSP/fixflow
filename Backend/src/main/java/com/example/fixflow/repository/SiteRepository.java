package com.example.fixflow.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.fixflow.domain.Site;

public interface SiteRepository extends JpaRepository<Site, Long> {

	Optional<Site> findFirstByNameIgnoreCase(String name);
}
