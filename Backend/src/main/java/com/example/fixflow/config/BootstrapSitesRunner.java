package com.example.fixflow.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.example.fixflow.domain.ContractStatus;
import com.example.fixflow.domain.Site;
import com.example.fixflow.domain.SiteType;
import com.example.fixflow.repository.SiteRepository;

/**
 * Seeds the three platform-owned sites that exist before any customer
 * onboards. They are ordinary sites — a super_admin manages them from the
 * Sites screen, and site admins later register their own sites through the
 * site-admin application flow.
 *
 * Insert-if-absent by name, so it is safe on every restart and never
 * overwrites an edited name/address.
 */
@Component
@Order(2)
public class BootstrapSitesRunner implements ApplicationRunner {

	private static final Logger log = LoggerFactory.getLogger(BootstrapSitesRunner.class);

	/**
	 * Edit these to rename the default sites. Keep the names in sync with
	 * what reporters should see in the registration picker.
	 */
	private static final Object[][] DEFAULT_SITES = {
			{ "CNU School", SiteType.school, "CNU main campus" },
			{ "CNU Hostel", SiteType.hostel, "CNU student residence" },
			{ "CNU Hotel", SiteType.hotel, "CNU hospitality building" },
	};

	private final SiteRepository siteRepository;

	public BootstrapSitesRunner(SiteRepository siteRepository) {
		this.siteRepository = siteRepository;
	}

	@Override
	@Transactional
	public void run(ApplicationArguments args) {
		for (Object[] spec : DEFAULT_SITES) {
			String name = (String) spec[0];
			if (siteRepository.findFirstByNameIgnoreCase(name).isPresent()) {
				continue;
			}
			Site site = new Site();
			site.setName(name);
			site.setType((SiteType) spec[1]);
			site.setAddress((String) spec[2]);
			site.setContractStatus(ContractStatus.contracted);
			siteRepository.save(site);
			log.info("Seeded default site: {}", name);
		}
	}
}
