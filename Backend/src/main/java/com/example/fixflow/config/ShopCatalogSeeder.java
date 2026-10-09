package com.example.fixflow.config;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.example.fixflow.domain.ShopProduct;
import com.example.fixflow.repository.ShopProductRepository;

@Component
@Order(2)
public class ShopCatalogSeeder implements ApplicationRunner {

	private final ShopProductRepository shopProductRepository;

	public ShopCatalogSeeder(ShopProductRepository shopProductRepository) {
		this.shopProductRepository = shopProductRepository;
	}

	@Override
	@Transactional
	public void run(ApplicationArguments args) {
		if (shopProductRepository.count() > 0) {
			return;
		}
		save("cordless-drill-18v", "18V Cordless Drill",
				"Compact cordless drill for everyday mounting and light woodwork around shared spaces.",
				"Power tools", "FixFlow Basics",
				"https://images.pexels.com/photos/11398216/pexels-photo-11398216.jpeg?auto=compress&cs=tinysrgb&w=800",
				8990, 25);
		save("multi-bit-set", "40-Piece Bit Set",
				"Mixed screwdriver and drill bits for common fixtures, furniture, and fittings.",
				"Hand tools", "FixFlow Basics",
				"https://images.pexels.com/photos/30413428/pexels-photo-30413428.jpeg?auto=compress&cs=tinysrgb&w=800",
				2490, 40);
		save("adjustable-wrench", "Adjustable Wrench 250mm",
				"Steel adjustable wrench for plumbing valves and general fastener work.",
				"Hand tools", null, null, 1890, 30);
		save("led-work-light", "Rechargeable LED Work Light",
				"Portable light for corridors, plant rooms, and after-hours repairs.",
				"Lighting", "BrightPath", null, 3290, 18);
		save("cable-ties-pack", "Cable Tie Assortment (200)",
				"Mixed lengths for tidy cable runs and temporary securing of fixtures.",
				"Electrical", null, null, 990, 60);
		save("silicone-sealant", "Neutral Silicone Sealant",
				"Bathroom and kitchen sealing for joints, splashbacks, and fittings.",
				"Consumables", "SealPro", null, 1290, 45);
		save("safety-gloves", "Cut-Resistant Work Gloves",
				"Pair of protective gloves sized for maintenance crews and DIY reporters.",
				"Safety", "GuardHand", null, 1590, 50);
		save("toolbox-small", "Compact Toolbox",
				"Organiser case for bits, fasteners, and small hand tools on site visits.",
				"Storage", "FixFlow Basics", null, 4590, 12);
	}

	private void save(
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
}
