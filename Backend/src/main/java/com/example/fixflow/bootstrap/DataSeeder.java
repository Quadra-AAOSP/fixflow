package com.example.fixflow.bootstrap;

import java.util.List;

import javax.sql.DataSource;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.example.fixflow.domain.ContractStatus;
import com.example.fixflow.domain.ShopProduct;
import com.example.fixflow.domain.Site;
import com.example.fixflow.domain.SiteRule;
import com.example.fixflow.domain.SiteType;
import com.example.fixflow.domain.Subsite;
import com.example.fixflow.domain.User;
import com.example.fixflow.domain.UserRole;
import com.example.fixflow.repository.ShopProductRepository;
import com.example.fixflow.repository.SiteRepository;
import com.example.fixflow.repository.SiteRuleRepository;
import com.example.fixflow.repository.SubsiteRepository;
import com.example.fixflow.repository.UserRepository;

/**
 * Single startup seeder: platform sites always; either demo SQL or reference
 * taxonomy / shop / super_admin depending on {@code fixflow.seed.demo-enabled}.
 */
@Component
public class DataSeeder implements ApplicationRunner {

	private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);

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

	private static final Object[][] DEFAULT_SITES = {
			{ "CNU School", SiteType.school, "CNU main campus" },
			{ "CNU Hostel", SiteType.hostel, "CNU student residence" },
			{ "CNU Hotel", SiteType.hotel, "CNU hospitality building" },
	};

	private final boolean demoEnabled;
	private final DataSource dataSource;
	private final SiteRepository siteRepository;
	private final SubsiteRepository subsiteRepository;
	private final SiteRuleRepository siteRuleRepository;
	private final ShopProductRepository shopProductRepository;
	private final UserRepository userRepository;
	private final PasswordEncoder passwordEncoder;
	private final BootstrapProperties bootstrapProperties;

	public DataSeeder(
			@Value("${fixflow.seed.demo-enabled:false}") boolean demoEnabled,
			DataSource dataSource,
			SiteRepository siteRepository,
			SubsiteRepository subsiteRepository,
			SiteRuleRepository siteRuleRepository,
			ShopProductRepository shopProductRepository,
			UserRepository userRepository,
			PasswordEncoder passwordEncoder,
			BootstrapProperties bootstrapProperties
	) {
		this.demoEnabled = demoEnabled;
		this.dataSource = dataSource;
		this.siteRepository = siteRepository;
		this.subsiteRepository = subsiteRepository;
		this.siteRuleRepository = siteRuleRepository;
		this.shopProductRepository = shopProductRepository;
		this.userRepository = userRepository;
		this.passwordEncoder = passwordEncoder;
		this.bootstrapProperties = bootstrapProperties;
	}

	@Override
	@Transactional
	public void run(ApplicationArguments args) {
		if (demoEnabled) {
			loadDemoSql();
		} else {
			seedSiteRules();
			seedShopCatalog();
			seedSuperAdmin();
		}
		seedPlatformSites();
	}

	private void loadDemoSql() {
		log.warn("Loading DEVELOPMENT demo SQL with publicly known passwords; never enable in production");
		ResourceDatabasePopulator loader = new ResourceDatabasePopulator();
		loader.setSqlScriptEncoding("UTF-8");
		loader.addScript(new ClassPathResource("db/demo-data.sql"));
		loader.execute(dataSource);
	}

	private void seedSiteRules() {
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

	private void seedShopCatalog() {
		if (shopProductRepository.count() > 0) {
			return;
		}
		saveProduct("cordless-drill-18v", "18V Cordless Drill",
				"Compact cordless drill for everyday mounting and light woodwork around shared spaces.",
				"Power tools", "FixFlow Basics",
				"https://images.pexels.com/photos/11398216/pexels-photo-11398216.jpeg?auto=compress&cs=tinysrgb&w=800",
				8990, 25);
		saveProduct("multi-bit-set", "40-Piece Bit Set",
				"Mixed screwdriver and drill bits for common fixtures, furniture, and fittings.",
				"Hand tools", "FixFlow Basics",
				"https://images.pexels.com/photos/30413428/pexels-photo-30413428.jpeg?auto=compress&cs=tinysrgb&w=800",
				2490, 40);
		saveProduct("adjustable-wrench", "Adjustable Wrench 250mm",
				"Steel adjustable wrench for plumbing valves and general fastener work.",
				"Hand tools", null, null, 1890, 30);
		saveProduct("led-work-light", "Rechargeable LED Work Light",
				"Portable light for corridors, plant rooms, and after-hours repairs.",
				"Lighting", "BrightPath", null, 3290, 18);
		saveProduct("cable-ties-pack", "Cable Tie Assortment (200)",
				"Mixed lengths for tidy cable runs and temporary securing of fixtures.",
				"Electrical", null, null, 990, 60);
		saveProduct("silicone-sealant", "Neutral Silicone Sealant",
				"Bathroom and kitchen sealing for joints, splashbacks, and fittings.",
				"Consumables", "SealPro", null, 1290, 45);
		saveProduct("safety-gloves", "Cut-Resistant Work Gloves",
				"Pair of protective gloves sized for maintenance crews and DIY reporters.",
				"Safety", "GuardHand", null, 1590, 50);
		saveProduct("toolbox-small", "Compact Toolbox",
				"Organiser case for bits, fasteners, and small hand tools on site visits.",
				"Storage", "FixFlow Basics", null, 4590, 12);
	}

	private void saveProduct(
			String id,
			String name,
			String description,
			String category,
			String brand,
			String imageUrl,
			int priceMinor,
			int stock
	) {
		ShopProduct product = new ShopProduct();
		product.setId(id);
		product.setName(name);
		product.setDescription(description);
		product.setCategory(category);
		product.setBrand(brand);
		product.setImageUrl(imageUrl);
		product.setPriceMinor(priceMinor);
		product.setStock(stock);
		product.setActive(true);
		shopProductRepository.save(product);
	}

	private void seedSuperAdmin() {
		if (userRepository.existsByRole(UserRole.super_admin)) {
			return;
		}
		String email = bootstrapProperties.superAdminEmail();
		String password = bootstrapProperties.superAdminPassword();
		if (email == null || email.isBlank() || password == null || password.isBlank()) {
			log.warn("No super_admin exists and bootstrap credentials are not configured");
			return;
		}
		User admin = new User();
		admin.setEmail(email.trim().toLowerCase());
		admin.setPasswordHash(passwordEncoder.encode(password));
		admin.setFirstName("Super");
		admin.setLastName("Admin");
		admin.setRole(UserRole.super_admin);
		userRepository.save(admin);
		log.info("Bootstrapped initial super_admin account: {}", admin.getEmail());
	}

	private void seedPlatformSites() {
		for (Object[] spec : DEFAULT_SITES) {
			String name = (String) spec[0];
			Site site = siteRepository.findFirstByNameIgnoreCase(name).orElse(null);
			if (site == null) {
				site = new Site();
				site.setName(name);
				site.setType((SiteType) spec[1]);
				site.setAddress((String) spec[2]);
				site.setContractStatus(ContractStatus.contracted);
				site = siteRepository.save(site);
				log.info("Seeded default site: {}", name);
			}
			if (!subsiteRepository.existsBySite_IdAndArchivedAtIsNull(site.getId())) {
				Subsite main = new Subsite();
				main.setSite(site);
				main.setLabel("MAIN");
				main.setName("Main building");
				subsiteRepository.save(main);
			}
		}
	}
}
