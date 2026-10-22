-- Authoritative startup taxonomy. Existing rules are never overwritten.
INSERT INTO site_rules(site_type,category,urgency_weight,sort_order)
SELECT 'school','plumbing',40,1 WHERE NOT EXISTS (SELECT 1 FROM site_rules WHERE site_type='school' AND category='plumbing');
INSERT INTO site_rules(site_type,category,urgency_weight,sort_order)
SELECT 'school','electrical',50,2 WHERE NOT EXISTS (SELECT 1 FROM site_rules WHERE site_type='school' AND category='electrical');
INSERT INTO site_rules(site_type,category,urgency_weight,sort_order)
SELECT 'school','hvac',35,3 WHERE NOT EXISTS (SELECT 1 FROM site_rules WHERE site_type='school' AND category='hvac');
INSERT INTO site_rules(site_type,category,urgency_weight,sort_order)
SELECT 'school','carpentry',20,4 WHERE NOT EXISTS (SELECT 1 FROM site_rules WHERE site_type='school' AND category='carpentry');
INSERT INTO site_rules(site_type,category,urgency_weight,sort_order)
SELECT 'school','cleaning',10,5 WHERE NOT EXISTS (SELECT 1 FROM site_rules WHERE site_type='school' AND category='cleaning');
INSERT INTO site_rules(site_type,category,urgency_weight,sort_order)
SELECT 'school','general',15,6 WHERE NOT EXISTS (SELECT 1 FROM site_rules WHERE site_type='school' AND category='general');
INSERT INTO site_rules(site_type,category,urgency_weight,sort_order)
SELECT 'hotel','plumbing',40,1 WHERE NOT EXISTS (SELECT 1 FROM site_rules WHERE site_type='hotel' AND category='plumbing');
INSERT INTO site_rules(site_type,category,urgency_weight,sort_order)
SELECT 'hotel','electrical',50,2 WHERE NOT EXISTS (SELECT 1 FROM site_rules WHERE site_type='hotel' AND category='electrical');
INSERT INTO site_rules(site_type,category,urgency_weight,sort_order)
SELECT 'hotel','hvac',35,3 WHERE NOT EXISTS (SELECT 1 FROM site_rules WHERE site_type='hotel' AND category='hvac');
INSERT INTO site_rules(site_type,category,urgency_weight,sort_order)
SELECT 'hotel','carpentry',20,4 WHERE NOT EXISTS (SELECT 1 FROM site_rules WHERE site_type='hotel' AND category='carpentry');
INSERT INTO site_rules(site_type,category,urgency_weight,sort_order)
SELECT 'hotel','cleaning',10,5 WHERE NOT EXISTS (SELECT 1 FROM site_rules WHERE site_type='hotel' AND category='cleaning');
INSERT INTO site_rules(site_type,category,urgency_weight,sort_order)
SELECT 'hotel','general',15,6 WHERE NOT EXISTS (SELECT 1 FROM site_rules WHERE site_type='hotel' AND category='general');
INSERT INTO site_rules(site_type,category,urgency_weight,sort_order)
SELECT 'hostel','plumbing',40,1 WHERE NOT EXISTS (SELECT 1 FROM site_rules WHERE site_type='hostel' AND category='plumbing');
INSERT INTO site_rules(site_type,category,urgency_weight,sort_order)
SELECT 'hostel','electrical',50,2 WHERE NOT EXISTS (SELECT 1 FROM site_rules WHERE site_type='hostel' AND category='electrical');
INSERT INTO site_rules(site_type,category,urgency_weight,sort_order)
SELECT 'hostel','hvac',35,3 WHERE NOT EXISTS (SELECT 1 FROM site_rules WHERE site_type='hostel' AND category='hvac');
INSERT INTO site_rules(site_type,category,urgency_weight,sort_order)
SELECT 'hostel','carpentry',20,4 WHERE NOT EXISTS (SELECT 1 FROM site_rules WHERE site_type='hostel' AND category='carpentry');
INSERT INTO site_rules(site_type,category,urgency_weight,sort_order)
SELECT 'hostel','cleaning',10,5 WHERE NOT EXISTS (SELECT 1 FROM site_rules WHERE site_type='hostel' AND category='cleaning');
INSERT INTO site_rules(site_type,category,urgency_weight,sort_order)
SELECT 'hostel','general',15,6 WHERE NOT EXISTS (SELECT 1 FROM site_rules WHERE site_type='hostel' AND category='general');

-- Startup shop catalogue. Existing stock, prices and admin edits are preserved.
INSERT INTO shop_products(id,name,description,category,brand,image_url,price_minor,stock,active,created_at,updated_at)
SELECT 'cordless-drill-18v','18V Cordless Drill','Compact cordless drill for everyday mounting and light woodwork around shared spaces.','Power tools','FixFlow Basics','https://images.pexels.com/photos/11398216/pexels-photo-11398216.jpeg?auto=compress&cs=tinysrgb&w=800',8990,25,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP WHERE NOT EXISTS (SELECT 1 FROM shop_products WHERE id='cordless-drill-18v');
INSERT INTO shop_products(id,name,description,category,brand,image_url,price_minor,stock,active,created_at,updated_at)
SELECT 'multi-bit-set','40-Piece Bit Set','Mixed screwdriver and drill bits for common fixtures, furniture, and fittings.','Hand tools','FixFlow Basics','https://images.pexels.com/photos/30413428/pexels-photo-30413428.jpeg?auto=compress&cs=tinysrgb&w=800',2490,40,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP WHERE NOT EXISTS (SELECT 1 FROM shop_products WHERE id='multi-bit-set');
INSERT INTO shop_products(id,name,description,category,brand,image_url,price_minor,stock,active,created_at,updated_at)
SELECT 'adjustable-wrench','Adjustable Wrench 250mm','Steel adjustable wrench for plumbing valves and general fastener work.','Hand tools',NULL,NULL,1890,30,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP WHERE NOT EXISTS (SELECT 1 FROM shop_products WHERE id='adjustable-wrench');
INSERT INTO shop_products(id,name,description,category,brand,image_url,price_minor,stock,active,created_at,updated_at)
SELECT 'led-work-light','Rechargeable LED Work Light','Portable light for corridors, plant rooms, and after-hours repairs.','Lighting','BrightPath',NULL,3290,18,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP WHERE NOT EXISTS (SELECT 1 FROM shop_products WHERE id='led-work-light');
INSERT INTO shop_products(id,name,description,category,brand,image_url,price_minor,stock,active,created_at,updated_at)
SELECT 'cable-ties-pack','Cable Tie Assortment (200)','Mixed lengths for tidy cable runs and temporary securing of fixtures.','Electrical',NULL,NULL,990,60,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP WHERE NOT EXISTS (SELECT 1 FROM shop_products WHERE id='cable-ties-pack');
INSERT INTO shop_products(id,name,description,category,brand,image_url,price_minor,stock,active,created_at,updated_at)
SELECT 'silicone-sealant','Neutral Silicone Sealant','Bathroom and kitchen sealing for joints, splashbacks, and fittings.','Consumables','SealPro',NULL,1290,45,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP WHERE NOT EXISTS (SELECT 1 FROM shop_products WHERE id='silicone-sealant');
INSERT INTO shop_products(id,name,description,category,brand,image_url,price_minor,stock,active,created_at,updated_at)
SELECT 'safety-gloves','Cut-Resistant Work Gloves','Pair of protective gloves sized for maintenance crews and DIY reporters.','Safety','GuardHand',NULL,1590,50,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP WHERE NOT EXISTS (SELECT 1 FROM shop_products WHERE id='safety-gloves');
INSERT INTO shop_products(id,name,description,category,brand,image_url,price_minor,stock,active,created_at,updated_at)
SELECT 'toolbox-small','Compact Toolbox','Organiser case for bits, fasteners, and small hand tools on site visits.','Storage','FixFlow Basics',NULL,4590,12,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP WHERE NOT EXISTS (SELECT 1 FROM shop_products WHERE id='toolbox-small');

