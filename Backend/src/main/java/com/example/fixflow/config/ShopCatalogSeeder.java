package com.example.fixflow.config;

import java.util.List;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.example.fixflow.domain.ShopProduct;
import com.example.fixflow.repository.ShopProductRepository;

@Component
@org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(
        prefix = "fixflow.seed", name = "demo-enabled", havingValue = "false", matchIfMissing = true)
@Order(2)
public class ShopCatalogSeeder implements ApplicationRunner {

	private final ShopProductRepository shopProductRepository;

	public ShopCatalogSeeder(ShopProductRepository shopProductRepository) {
		this.shopProductRepository = shopProductRepository;
	}

	/**
	 * Demo catalogue. Every entry carries a product photo from the Pexels CDN so
	 * no tile falls back to the "Image unavailable" placeholder. Six products
	 * shipped without an image because only the first two rows had a URL.
	 */
	private static final List<Seed> CATALOG = List.of(
			new Seed("cordless-drill-18v", "18V Cordless Drill",
					"Compact cordless drill for everyday mounting and light woodwork around shared spaces.",
					"Power tools", "FixFlow Basics",
					"https://images.pexels.com/photos/11398216/pexels-photo-11398216.jpeg?auto=compress&cs=tinysrgb&w=800",
					8990, 25),
			new Seed("multi-bit-set", "40-Piece Bit Set",
					"Mixed screwdriver and drill bits for common fixtures, furniture, and fittings.",
					"Hand tools", "FixFlow Basics",
					"https://images.pexels.com/photos/16720099/pexels-photo-16720099.jpeg?auto=compress&cs=tinysrgb&w=800",
					2490, 40),
			new Seed("adjustable-wrench", "Adjustable Wrench 250mm",
					"Steel adjustable wrench for plumbing valves and general fastener work.",
					"Hand tools", null,
					"https://images.pexels.com/photos/30413496/pexels-photo-30413496.jpeg?auto=compress&cs=tinysrgb&w=800",
					1890, 30),
			new Seed("led-work-light", "Rechargeable LED Work Light",
					"Portable light for corridors, plant rooms, and after-hours repairs.",
					"Lighting", "BrightPath",
					"https://images.pexels.com/photos/33614620/pexels-photo-33614620.jpeg?auto=compress&cs=tinysrgb&w=800",
					3290, 18),
			new Seed("cable-ties-pack", "Cable Tie Assortment (200)",
					"Mixed lengths for tidy cable runs and temporary securing of fixtures.",
					"Electrical", null,
					"https://images.pexels.com/photos/11382339/pexels-photo-11382339.jpeg?auto=compress&cs=tinysrgb&w=800",
					990, 60),
			new Seed("silicone-sealant", "Neutral Silicone Sealant",
					"Bathroom and kitchen sealing for joints, splashbacks, and fittings.",
					"Consumables", "SealPro",
					"https://images.pexels.com/photos/6124242/pexels-photo-6124242.jpeg?auto=compress&cs=tinysrgb&w=800",
					1290, 45),
			new Seed("safety-gloves", "Cut-Resistant Work Gloves",
					"Pair of protective gloves sized for maintenance crews and DIY reporters.",
					"Safety", "GuardHand",
					"https://images.pexels.com/photos/8488007/pexels-photo-8488007.jpeg?auto=compress&cs=tinysrgb&w=800",
					1590, 50),
			new Seed("toolbox-small", "Compact Toolbox",
					"Organiser case for bits, fasteners, and small hand tools on site visits.",
					"Storage", "FixFlow Basics",
					"https://images.pexels.com/photos/11882650/pexels-photo-11882650.jpeg?auto=compress&cs=tinysrgb&w=800",
					4590, 12),
			new Seed("tape-measure-5m", "Tape Measure 5m",
					"Retractable 5 m tape with a locking blade for measuring rooms and fittings.",
					"Hand tools", "FixFlow Basics",
					"https://images.pexels.com/photos/3143082/pexels-photo-3143082.jpeg?auto=compress&cs=tinysrgb&w=800",
					1290, 35),
			new Seed("safety-goggles", "Safety Goggles",
					"Impact-rated goggles for drilling, cutting, and handling cleaning chemicals.",
					"Safety", "GuardHand",
					"https://images.pexels.com/photos/9242909/pexels-photo-9242909.jpeg?auto=compress&cs=tinysrgb&w=800",
					890, 40),
			new Seed("utility-knife", "Retractable Utility Knife",
					"Retractable blade knife for opening cartons and trimming sealant and board.",
					"Hand tools", "FixFlow Basics",
					"https://images.pexels.com/photos/19327094/pexels-photo-19327094.jpeg?auto=compress&cs=tinysrgb&w=800",
					990, 55),
			new Seed("extension-lead-10m", "10m Extension Lead",
					"Four-socket extension lead for tools that need to reach across a floor or site.",
					"Electrical", "BrightPath",
					"https://images.pexels.com/photos/8101095/pexels-photo-8101095.jpeg?auto=compress&cs=tinysrgb&w=800",
					2790, 20),
			new Seed("claw-hammer-450g", "Claw Hammer 450g",
					"Steel claw hammer with a fibre handle for driving and pulling nails.",
					"Hand tools", "FixFlow Basics",
					"https://images.pexels.com/photos/4919430/pexels-photo-4919430.jpeg?auto=compress&cs=tinysrgb&w=800",
					1990, 22),
			new Seed("insulated-pliers", "Insulated Plier Set",
					"Two-piece insulated plier set for electrical work and general gripping.",
					"Electrical", "FixFlow Basics",
					"https://images.pexels.com/photos/5853932/pexels-photo-5853932.jpeg?auto=compress&cs=tinysrgb&w=800",
					2190, 24));

	@Override
	@Transactional
	public void run(ApplicationArguments args) {
		// Repeatable upsert: an existing row keeps its price, stock, and copy,
		// but a missing photo is filled in — six of the eight demo products were
		// seeded without an image and rendered "Image unavailable" in the shop.
		for (Seed seed : CATALOG) {
			ShopProduct existing = shopProductRepository.findById(seed.id()).orElse(null);
			if (existing == null) {
				shopProductRepository.save(toEntity(seed));
				continue;
			}
			if (isMissingOrRetiredImage(existing.getImageUrl())) {
				existing.setImageUrl(seed.imageUrl());
				shopProductRepository.save(existing);
			}
		}
	}

	/**
	 * Earlier demo builds shipped image URLs from wikimedia.org and
	 * staticflickr.com; those hosts are not reachable from every network this
	 * app is developed on, so rows still pointing there are repaired to the
	 * current Pexels CDN photos. Admin-set Pexels URLs are left untouched.
	 */
	private boolean isMissingOrRetiredImage(String imageUrl) {
		if (imageUrl == null || imageUrl.isBlank()) {
			return true;
		}
		return imageUrl.contains("wikimedia.org") || imageUrl.contains("staticflickr.com");
	}

	private ShopProduct toEntity(Seed seed) {
		ShopProduct product = new ShopProduct();
		product.setId(seed.id());
		product.setName(seed.name());
		product.setDescription(seed.description());
		product.setCategory(seed.category());
		product.setBrand(seed.brand());
		product.setImageUrl(seed.imageUrl());
		product.setPriceMinor(seed.priceMinor());
		product.setStock(seed.stock());
		product.setActive(true);
		return product;
	}

	private record Seed(
			String id,
			String name,
			String description,
			String category,
			String brand,
			String imageUrl,
			int priceMinor,
			int stock
	) {
	}
}
