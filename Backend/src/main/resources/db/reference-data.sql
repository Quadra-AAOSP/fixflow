-- FixFlow reference data: site_rules taxonomy + shop catalog.
-- Repeatable: INSERT IGNORE / unique keys; does not overwrite stock or weights.

-- site_rules: SiteType x categories (from SiteRulesSeeder)
INSERT IGNORE INTO site_rules (site_type, category, urgency_weight, sort_order) VALUES ('school', 'plumbing', 40, 1);
INSERT IGNORE INTO site_rules (site_type, category, urgency_weight, sort_order) VALUES ('school', 'electrical', 50, 2);
INSERT IGNORE INTO site_rules (site_type, category, urgency_weight, sort_order) VALUES ('school', 'hvac', 35, 3);
INSERT IGNORE INTO site_rules (site_type, category, urgency_weight, sort_order) VALUES ('school', 'carpentry', 20, 4);
INSERT IGNORE INTO site_rules (site_type, category, urgency_weight, sort_order) VALUES ('school', 'cleaning', 10, 5);
INSERT IGNORE INTO site_rules (site_type, category, urgency_weight, sort_order) VALUES ('school', 'general', 15, 6);
INSERT IGNORE INTO site_rules (site_type, category, urgency_weight, sort_order) VALUES ('hostel', 'plumbing', 40, 1);
INSERT IGNORE INTO site_rules (site_type, category, urgency_weight, sort_order) VALUES ('hostel', 'electrical', 50, 2);
INSERT IGNORE INTO site_rules (site_type, category, urgency_weight, sort_order) VALUES ('hostel', 'hvac', 35, 3);
INSERT IGNORE INTO site_rules (site_type, category, urgency_weight, sort_order) VALUES ('hostel', 'carpentry', 20, 4);
INSERT IGNORE INTO site_rules (site_type, category, urgency_weight, sort_order) VALUES ('hostel', 'cleaning', 10, 5);
INSERT IGNORE INTO site_rules (site_type, category, urgency_weight, sort_order) VALUES ('hostel', 'general', 15, 6);
INSERT IGNORE INTO site_rules (site_type, category, urgency_weight, sort_order) VALUES ('hotel', 'plumbing', 40, 1);
INSERT IGNORE INTO site_rules (site_type, category, urgency_weight, sort_order) VALUES ('hotel', 'electrical', 50, 2);
INSERT IGNORE INTO site_rules (site_type, category, urgency_weight, sort_order) VALUES ('hotel', 'hvac', 35, 3);
INSERT IGNORE INTO site_rules (site_type, category, urgency_weight, sort_order) VALUES ('hotel', 'carpentry', 20, 4);
INSERT IGNORE INTO site_rules (site_type, category, urgency_weight, sort_order) VALUES ('hotel', 'cleaning', 10, 5);
INSERT IGNORE INTO site_rules (site_type, category, urgency_weight, sort_order) VALUES ('hotel', 'general', 15, 6);

-- shop_products: from ShopCatalogSeeder (fixed ids)
INSERT IGNORE INTO shop_products (id, name, description, category, brand, image_url, price_minor, stock, active, created_at, updated_at) VALUES ('cordless-drill-18v', '18V Cordless Drill', 'Compact cordless drill for everyday mounting and light woodwork around shared spaces.', 'Power tools', 'FixFlow Basics', 'https://images.pexels.com/photos/11398216/pexels-photo-11398216.jpeg?auto=compress&cs=tinysrgb&w=800', 8990, 25, TRUE, '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000');
INSERT IGNORE INTO shop_products (id, name, description, category, brand, image_url, price_minor, stock, active, created_at, updated_at) VALUES ('multi-bit-set', '40-Piece Bit Set', 'Mixed screwdriver and drill bits for common fixtures, furniture, and fittings.', 'Hand tools', 'FixFlow Basics', 'https://images.pexels.com/photos/30413428/pexels-photo-30413428.jpeg?auto=compress&cs=tinysrgb&w=800', 2490, 40, TRUE, '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000');
INSERT IGNORE INTO shop_products (id, name, description, category, brand, image_url, price_minor, stock, active, created_at, updated_at) VALUES ('adjustable-wrench', 'Adjustable Wrench 250mm', 'Steel adjustable wrench for plumbing valves and general fastener work.', 'Hand tools', NULL, NULL, 1890, 30, TRUE, '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000');
INSERT IGNORE INTO shop_products (id, name, description, category, brand, image_url, price_minor, stock, active, created_at, updated_at) VALUES ('led-work-light', 'Rechargeable LED Work Light', 'Portable light for corridors, plant rooms, and after-hours repairs.', 'Lighting', 'BrightPath', NULL, 3290, 18, TRUE, '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000');
INSERT IGNORE INTO shop_products (id, name, description, category, brand, image_url, price_minor, stock, active, created_at, updated_at) VALUES ('cable-ties-pack', 'Cable Tie Assortment (200)', 'Mixed lengths for tidy cable runs and temporary securing of fixtures.', 'Electrical', NULL, NULL, 990, 60, TRUE, '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000');
INSERT IGNORE INTO shop_products (id, name, description, category, brand, image_url, price_minor, stock, active, created_at, updated_at) VALUES ('silicone-sealant', 'Neutral Silicone Sealant', 'Bathroom and kitchen sealing for joints, splashbacks, and fittings.', 'Consumables', 'SealPro', NULL, 1290, 45, TRUE, '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000');
INSERT IGNORE INTO shop_products (id, name, description, category, brand, image_url, price_minor, stock, active, created_at, updated_at) VALUES ('safety-gloves', 'Cut-Resistant Work Gloves', 'Pair of protective gloves sized for maintenance crews and DIY reporters.', 'Safety', 'GuardHand', NULL, 1590, 50, TRUE, '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000');
INSERT IGNORE INTO shop_products (id, name, description, category, brand, image_url, price_minor, stock, active, created_at, updated_at) VALUES ('toolbox-small', 'Compact Toolbox', 'Organiser case for bits, fasteners, and small hand tools on site visits.', 'Storage', 'FixFlow Basics', NULL, 4590, 12, TRUE, '2026-01-15 10:00:00.000000', '2026-01-15 10:00:00.000000');
