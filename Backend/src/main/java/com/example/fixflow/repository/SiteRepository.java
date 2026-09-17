package com.example.fixflow.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.fixflow.domain.Site;

public interface SiteRepository extends JpaRepository<Site, Long> {
}
