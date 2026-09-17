package com.example.fixflow.config;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.example.fixflow.domain.SiteRule;
import com.example.fixflow.domain.SiteType;
import com.example.fixflow.repository.SiteRuleRepository;

@Component
@Order(1)
public class SiteRulesSeeder implements ApplicationRunner {

	private static final Logger log = LoggerFactory.getLogger(SiteRulesSeeder.class);

	private record SeedCategory(String category, int urgencyWeight, int sortOrder) {
	}

	private static final List<SeedCategory> DEFAULT_CATEGORIES = List.of(
			new SeedCategory("plumbing", 40, 1),
			new SeedCategory("electrical", 50, 2),
			new SeedCategory("hvac", 35, 3),
			new SeedCategory("carpentry", 20, 4),
			new SeedCategory("cleaning", 10, 5),
			new SeedCategory("general", 15, 6)
	);

	private final SiteRuleRepository siteRuleRepository;

	public SiteRulesSeeder(SiteRuleRepository siteRuleRepository) {
		this.siteRuleRepository = siteRuleRepository;
	}

	@Override
	@Transactional
	public void run(ApplicationArguments args) {
		int created = 0;
		for (SiteType type : SiteType.values()) {
			for (SeedCategory seed : DEFAULT_CATEGORIES) {
				if (siteRuleRepository.existsBySiteTypeAndCategory(type, seed.category())) {
					continue;
				}
				SiteRule rule = new SiteRule();
				rule.setSiteType(type);
				rule.setCategory(seed.category());
				rule.setUrgencyWeight(seed.urgencyWeight());
				rule.setSortOrder(seed.sortOrder());
				siteRuleRepository.save(rule);
				created++;
			}
		}
		if (created > 0) {
			log.info("Seeded {} site_rules taxonomy rows", created);
		}
	}
}
