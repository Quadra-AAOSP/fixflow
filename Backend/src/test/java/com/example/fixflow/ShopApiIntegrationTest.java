package com.example.fixflow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import com.example.fixflow.domain.ContractStatus;
import com.example.fixflow.domain.ShopOrderStatus;
import com.example.fixflow.domain.ShopProduct;
import com.example.fixflow.domain.Site;
import com.example.fixflow.domain.SiteType;
import com.example.fixflow.domain.User;
import com.example.fixflow.domain.UserRole;
import com.example.fixflow.repository.ShopOrderRepository;
import com.example.fixflow.repository.ShopProductRepository;
import com.example.fixflow.repository.SiteRepository;
import com.example.fixflow.repository.UserRepository;
import com.example.fixflow.security.AppUserDetails;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

@SpringBootTest
class ShopApiIntegrationTest {

	@Autowired
	private WebApplicationContext webApplicationContext;

	@Autowired
	private SiteRepository siteRepository;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private ShopProductRepository shopProductRepository;

	@Autowired
	private ShopOrderRepository shopOrderRepository;

	@Autowired
	private PasswordEncoder passwordEncoder;

	@Autowired
	private ObjectMapper objectMapper;

	@Autowired
	private jakarta.persistence.EntityManager entityManager;

	@Autowired
	private com.example.fixflow.service.ShopOrderService orderService;

	private MockMvc mockMvc;
	private User reporter;
	private User admin;
	private ShopProduct product;

	@BeforeEach
	void setUp() {
		mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
				.apply(springSecurity()).defaultRequest(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/").with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf()))
				.build();

		Site site = siteRepository.findAll().stream().findFirst().orElseGet(() -> {
			Site created = new Site();
			created.setName("Shop Test Site");
			created.setType(SiteType.hostel);
			created.setContractStatus(ContractStatus.contracted);
			return siteRepository.save(created);
		});

		admin = userRepository.findByEmailIgnoreCase("admin@fixflow.local").orElseGet(() -> {
			User created = new User();
			created.setEmail("admin@fixflow.local");
			created.setPasswordHash(passwordEncoder.encode("test-admin-pass"));
			created.setFirstName("Super");
			created.setLastName("Admin");
			created.setRole(UserRole.super_admin);
			return userRepository.save(created);
		});

		reporter = new User();
		reporter.setEmail("shop-reporter-" + System.nanoTime() + "@example.com");
		reporter.setPasswordHash(passwordEncoder.encode("password123"));
		reporter.setFirstName("Shop");
		reporter.setLastName("Buyer");
		// Shop routes require a staff-side role (not reporter).
		reporter.setRole(UserRole.staff);
		reporter.setSite(site);
		reporter = userRepository.save(reporter);

		String productId = "test-drill-" + System.nanoTime();
		product = new ShopProduct();
		product.setId(productId);
		product.setName("Test Drill");
		product.setDescription("Integration test drill");
		product.setCategory("Power tools");
		product.setBrand("TestBrand");
		product.setImageUrl("https://example.com/drill.jpg");
		product.setPriceMinor(1000);
		product.setStock(10);
		product.setActive(true);
		product = shopProductRepository.save(product);
	}

	@Test
	void shopManagerCanManageShopButCannotProvisionAccounts() throws Exception {
		User manager = new User();
		manager.setEmail("shop-manager-" + System.nanoTime() + "@example.com");
		manager.setPasswordHash("unused");
		manager.setFirstName("Shop"); manager.setLastName("Manager");
		manager.setRole(UserRole.shop_manager);
		manager = userRepository.save(manager);
		mockMvc.perform(get("/api/admin/shop/products").with(user(new AppUserDetails(manager))))
				.andExpect(status().isOk());
		mockMvc.perform(post("/api/admin/users").with(user(new AppUserDetails(manager)))
				.contentType(MediaType.APPLICATION_JSON).content("{}"))
				.andExpect(status().isForbidden());
		mockMvc.perform(get("/api/admin/site-admin-applications")
				.with(user(new AppUserDetails(manager)))).andExpect(status().isForbidden());
		mockMvc.perform(post("/api/sites/" + reporter.getSite().getId() + "/subsites")
				.with(user(new AppUserDetails(manager))).contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"label":"NO","name":"Not allowed"}
						"""))
				.andExpect(status().isForbidden());
		User siteAdmin = new User();
		siteAdmin.setEmail("shop-site-admin-" + System.nanoTime() + "@example.com");
		siteAdmin.setPasswordHash("unused"); siteAdmin.setFirstName("Site"); siteAdmin.setLastName("Admin");
		siteAdmin.setRole(UserRole.admin); siteAdmin.setSite(reporter.getSite());
		siteAdmin = userRepository.save(siteAdmin);
		mockMvc.perform(get("/api/admin/shop/products").with(user(new AppUserDetails(siteAdmin))))
				.andExpect(status().isForbidden());
	}

	@Test
	void catalogIsPublicAndIncludesActiveProducts() throws Exception {
		mockMvc.perform(get("/api/shop/catalog"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.currency").value("SGD"))
				.andExpect(jsonPath("$.minorUnitDigits").value(2))
				.andExpect(jsonPath("$.products[?(@.id=='" + product.getId() + "')].priceMinor").value(1000));
	}

	@Test
	void createOrderReservesStockAndIsIdempotent() throws Exception {
		String body = """
				{
				  "items": [{"productId": "%s", "quantity": 2}],
				  "shippingName": "Shop Buyer",
				  "shippingPhone": "+6500000000",
				  "shippingAddress": "1 Test Street"
				}
				""".formatted(product.getId());

		MvcResult first = mockMvc.perform(post("/api/shop/orders")
						.with(user(new AppUserDetails(reporter)))
						.contentType(MediaType.APPLICATION_JSON)
						.header("Idempotency-Key", "idem-shop-1")
						.content(body))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.orderId").isNotEmpty())
				.andExpect(jsonPath("$.paymentProvider").value("dev"))
				.andExpect(jsonPath("$.checkoutUrl").isNotEmpty())
				.andReturn();

		JsonNode created = objectMapper.readTree(first.getResponse().getContentAsString());
		String orderId = created.get("orderId").asText();

		mockMvc.perform(post("/api/shop/orders")
						.with(user(new AppUserDetails(reporter)))
						.contentType(MediaType.APPLICATION_JSON)
						.header("Idempotency-Key", "idem-shop-1")
						.content(body))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.orderId").value(orderId));

		ShopProduct refreshed = shopProductRepository.findById(product.getId()).orElseThrow();
		assertThat(refreshed.getStock()).isEqualTo(8);
		assertThat(shopOrderRepository.findByPublicId(orderId)).isPresent();
	}

	@Test
	void cancelRestoresStockAndDevPaymentMarksPaid() throws Exception {
		String body = """
				{
				  "items": [{"productId": "%s", "quantity": 3}],
				  "shippingName": "Shop Buyer",
				  "shippingAddress": "1 Test Street"
				}
				""".formatted(product.getId());

		MvcResult createdResult = mockMvc.perform(post("/api/shop/orders")
						.with(user(new AppUserDetails(reporter)))
						.contentType(MediaType.APPLICATION_JSON)
						.header("Idempotency-Key", "idem-shop-cancel")
						.content(body))
				.andExpect(status().isCreated())
				.andReturn();
		String orderId = objectMapper.readTree(createdResult.getResponse().getContentAsString())
				.get("orderId").asText();

		assertThat(shopProductRepository.findById(product.getId()).orElseThrow().getStock()).isEqualTo(7);

		mockMvc.perform(post("/api/shop/orders/" + orderId + "/cancel")
						.with(user(new AppUserDetails(reporter))))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("cancelled"));

		assertThat(shopProductRepository.findById(product.getId()).orElseThrow().getStock()).isEqualTo(10);

		MvcResult paidCreate = mockMvc.perform(post("/api/shop/orders")
						.with(user(new AppUserDetails(reporter)))
						.contentType(MediaType.APPLICATION_JSON)
						.header("Idempotency-Key", "idem-shop-pay")
						.content(body))
				.andExpect(status().isCreated())
				.andReturn();
		String paidOrderId = objectMapper.readTree(paidCreate.getResponse().getContentAsString())
				.get("orderId").asText();

		mockMvc.perform(post("/api/shop/payments/dev/complete/" + paidOrderId)
						.with(user(new AppUserDetails(reporter))))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("paid"));

		assertThat(shopOrderRepository.findByPublicId(paidOrderId).orElseThrow().getStatus())
				.isEqualTo(ShopOrderStatus.paid);
		assertThat(shopProductRepository.findById(product.getId()).orElseThrow().getStock()).isEqualTo(7);
	}

	@Test
	void adminCanCreateProductAndQuoteRequiresAuth() throws Exception {
		mockMvc.perform(post("/api/shop/checkout/quote")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"items":[{"productId":"%s","quantity":1}]}
								""".formatted(product.getId())))
				.andExpect(status().isUnauthorized());

		String newId = "admin-product-" + System.nanoTime();
		mockMvc.perform(post("/api/admin/shop/products")
						.with(user(new AppUserDetails(admin)))
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "id": "%s",
								  "name": "Admin Wrench",
								  "description": "Created by admin",
								  "category": "Hand tools",
								  "brand": null,
								  "imageUrl": "https://example.com/wrench.jpg",
								  "priceMinor": 1500,
								  "stock": 5,
								  "active": true
								}
								""".formatted(newId)))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.id").value(newId));

		mockMvc.perform(post("/api/shop/checkout/quote")
						.with(user(new AppUserDetails(reporter)))
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"items":[{"productId":"%s","quantity":1}]}
								""".formatted(newId)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.subtotalMinor").value(1500))
				.andExpect(jsonPath("$.shippingMinor").value(500))
				.andExpect(jsonPath("$.totalMinor").value(2000));
	}

	@Test
	void rejectsOversell() throws Exception {
		mockMvc.perform(post("/api/shop/orders")
						.with(user(new AppUserDetails(reporter)))
						.contentType(MediaType.APPLICATION_JSON)
						.header("Idempotency-Key", "idem-over")
						.content("""
								{
								  "items": [{"productId": "%s", "quantity": 99}],
								  "shippingName": "Shop Buyer",
								  "shippingAddress": "1 Test Street"
								}
								""".formatted(product.getId())))
				.andExpect(status().isConflict());
	}
	@Test
	void analyticsIsRestrictedAndProvidesThirtyUtcDays() throws Exception {
		mockMvc.perform(get("/api/admin/shop/analytics").with(user(new AppUserDetails(reporter))))
				.andExpect(status().isForbidden());
		mockMvc.perform(get("/api/admin/shop/analytics").with(user(new AppUserDetails(admin))))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.daily.length()").value(30))
				.andExpect(jsonPath("$.ordersByStatus.paid").isNumber())
				.andExpect(jsonPath("$.products.active").isNumber());
	}

	@Test
	@org.springframework.transaction.annotation.Transactional
	void analyticsGroupsMoneyAndExcludesRefunds() throws Exception {
		for (int n = 0; n < 5; n++) {
			com.example.fixflow.domain.ShopOrder order = new com.example.fixflow.domain.ShopOrder();
			order.setPublicId(java.util.UUID.randomUUID().toString());
			order.setUser(reporter);
			order.setStatus(n == 2 ? ShopOrderStatus.refunded : ShopOrderStatus.paid);
			order.setCurrency(n == 4 ? "XYZ" : "TST");
			order.setMinorUnitDigits(n == 3 ? 0 : 2);
			order.setTotalMinor(n < 3 ? 1_500_000_000 : 12);
			order.setShippingName("Private");
			order.setShippingAddress("Private");
			order.setIdempotencyKey(java.util.UUID.randomUUID().toString());
			shopOrderRepository.save(order);
		}
		mockMvc.perform(get("/api/admin/shop/analytics").with(user(new AppUserDetails(admin))))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.revenue[?(@.currency == 'TST' && @.minorUnitDigits == 2)].totalMinor").value(3_000_000_000L))
				.andExpect(jsonPath("$.revenue[?(@.currency == 'TST' && @.minorUnitDigits == 0)].totalMinor").value(12))
				.andExpect(jsonPath("$.revenue[?(@.currency == 'XYZ')].totalMinor").value(12));
	}

	@Test
	void analyticsAccessMatchesShopRoles() throws Exception {
		mockMvc.perform(get("/api/admin/shop/analytics")).andExpect(status().isUnauthorized());
		for (UserRole role : UserRole.values()) {
			User candidate = new User();
			candidate.setEmail("analytics-" + role + "@example.com");
			candidate.setPasswordHash("unused");
			candidate.setRole(role);
			int expected = role == UserRole.shop_manager || role == UserRole.super_admin ? 200 : 403;
			mockMvc.perform(get("/api/admin/shop/analytics").with(user(new AppUserDetails(candidate))))
					.andExpect(status().is(expected));
		}
	}

	@Test
	@org.springframework.transaction.annotation.Transactional
	void analyticsUsesUtcOrderCreationDate() throws Exception {
		com.example.fixflow.domain.ShopOrder order = new com.example.fixflow.domain.ShopOrder();
		order.setPublicId(java.util.UUID.randomUUID().toString());
		order.setUser(reporter);
		order.setStatus(ShopOrderStatus.paid);
		order.setCurrency("UTC");
		order.setMinorUnitDigits(2);
		order.setTotalMinor(7);
		order.setShippingName("Private");
		order.setShippingAddress("Private");
		order.setIdempotencyKey(java.util.UUID.randomUUID().toString());
		shopOrderRepository.saveAndFlush(order);
		java.time.LocalDate yesterday = java.time.LocalDate.now(java.time.ZoneOffset.UTC).minusDays(1);
		java.time.Instant timestamp = yesterday.atTime(23, 59).toInstant(java.time.ZoneOffset.UTC);
		entityManager.createNativeQuery("update shop_orders set created_at = :created where id = :id")
				.setParameter("created", timestamp).setParameter("id", order.getId()).executeUpdate();
		MvcResult result = mockMvc.perform(get("/api/admin/shop/analytics").with(user(new AppUserDetails(admin))))
				.andExpect(status().isOk()).andReturn();
		JsonNode daily = objectMapper.readTree(result.getResponse().getContentAsString()).path("daily");
		JsonNode bucket = daily.get(28);
		assertThat(bucket.path("date").asText()).isEqualTo(yesterday.toString());
		assertThat(bucket.path("revenue").toString()).contains("UTC");
	}

	@Test
	@org.springframework.transaction.annotation.Transactional
	void analyticsCountsActiveStock() throws Exception {
		product.setStock(0);
		shopProductRepository.saveAndFlush(product);
		long total = shopProductRepository.count();
		long active = shopProductRepository.countByActiveTrue();
		long inStock = shopProductRepository.countByActiveTrueAndStockGreaterThan(0);
		long outOfStock = shopProductRepository.countByActiveTrueAndStockLessThanEqual(0);
		mockMvc.perform(get("/api/admin/shop/analytics").with(user(new AppUserDetails(admin))))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.products.total").value(total))
				.andExpect(jsonPath("$.products.active").value(active))
				.andExpect(jsonPath("$.products.inStock").value(inStock))
				.andExpect(jsonPath("$.products.outOfStock").value(outOfStock));
	}

	@Test
	void shopManagerCanViewOrderQueueButCannotBuy() throws Exception {
		User manager = new User();
		manager.setEmail("manager-" + System.nanoTime() + "@example.com");
		manager.setPasswordHash("unused");
		manager.setFirstName("Shop");
		manager.setLastName("Manager");
		manager.setRole(UserRole.shop_manager);
		manager = userRepository.save(manager);
		mockMvc.perform(get("/api/admin/shop/orders").with(user(new AppUserDetails(manager))))
				.andExpect(status().isOk()).andExpect(jsonPath("$.content").isArray());
		mockMvc.perform(post("/api/shop/checkout/quote").with(user(new AppUserDetails(manager)))
				.contentType(MediaType.APPLICATION_JSON).content("{\"items\":[{\"productId\":\"test\",\"quantity\":1}]}"))
				.andExpect(status().isForbidden());
	}

	@Test
	void paidOrderFulfillsSequentiallyWithPrivateReceiptAndNotice() throws Exception {
		String body = "{\"items\":[{\"productId\":\"" + product.getId() + "\",\"quantity\":1}],\"shippingName\":\"Buyer\",\"shippingAddress\":\"Address\"}";
		MvcResult created = mockMvc.perform(post("/api/shop/orders").with(user(new AppUserDetails(reporter)))
				.contentType(MediaType.APPLICATION_JSON).header("Idempotency-Key", "fulfillment-" + System.nanoTime()).content(body))
				.andExpect(status().isCreated()).andReturn();
		String id = objectMapper.readTree(created.getResponse().getContentAsString()).get("orderId").asText();
		String action = "/api/admin/shop/orders/" + id + "/fulfillment";
		mockMvc.perform(post(action).with(user(new AppUserDetails(admin))).contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"processing\"}"))
				.andExpect(status().isConflict());
		mockMvc.perform(post("/api/shop/payments/dev/complete/" + id).with(user(new AppUserDetails(reporter))))
				.andExpect(status().isOk()).andExpect(jsonPath("$.fulfillmentStatus").value("ordered"));
		mockMvc.perform(post(action).with(user(new AppUserDetails(admin))).contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"shipped\"}"))
				.andExpect(status().isConflict());
		for (String state : java.util.List.of("processing", "shipped", "shipped")) {
			mockMvc.perform(post(action).with(user(new AppUserDetails(admin))).contentType(MediaType.APPLICATION_JSON)
					.content("{\"status\":\"" + state + "\"}"))
					.andExpect(status().isOk()).andExpect(jsonPath("$.checkoutUrl").doesNotExist());
		}
		mockMvc.perform(get("/api/shop/notifications").with(user(new AppUserDetails(reporter))))
				.andExpect(status().isOk()).andExpect(jsonPath("$.content[0].orderId").value(id));
		String confirm = "/api/shop/orders/" + id + "/confirm-delivery";
		mockMvc.perform(post(confirm).with(user(new AppUserDetails(admin))).contentType(MediaType.APPLICATION_JSON)
				.content("{\"signedName\":\"Other\",\"received\":true}")).andExpect(status().isNotFound());
		mockMvc.perform(post(confirm).with(user(new AppUserDetails(reporter))).contentType(MediaType.APPLICATION_JSON)
				.content("{\"signedName\":\"Buyer\",\"received\":false}")).andExpect(status().isBadRequest());
		for (int n = 0; n < 2; n++) {
			mockMvc.perform(post(confirm).with(user(new AppUserDetails(reporter))).contentType(MediaType.APPLICATION_JSON)
					.content("{\"signedName\":\"Buyer\",\"received\":true}"))
					.andExpect(status().isOk()).andExpect(jsonPath("$.fulfillmentStatus").value("delivered"));
		}
		mockMvc.perform(post(confirm).with(user(new AppUserDetails(reporter))).contentType(MediaType.APPLICATION_JSON)
				.content("{\"signedName\":\"Different\",\"received\":true}")).andExpect(status().isConflict());
	}

	@Test
	void concurrentShipmentRetriesCreateOneNotice() throws Exception {
		String body = "{\"items\":[{\"productId\":\"" + product.getId() + "\",\"quantity\":1}],\"shippingName\":\"Buyer\",\"shippingAddress\":\"Address\"}";
		MvcResult created = mockMvc.perform(post("/api/shop/orders").with(user(new AppUserDetails(reporter)))
				.contentType(MediaType.APPLICATION_JSON).header("Idempotency-Key", "race-" + System.nanoTime()).content(body))
				.andExpect(status().isCreated()).andReturn();
		String id = objectMapper.readTree(created.getResponse().getContentAsString()).get("orderId").asText();
		mockMvc.perform(post("/api/shop/payments/dev/complete/" + id).with(user(new AppUserDetails(reporter))))
				.andExpect(status().isOk());
		String action = "/api/admin/shop/orders/" + id + "/fulfillment";
		mockMvc.perform(post(action).with(user(new AppUserDetails(admin))).contentType(MediaType.APPLICATION_JSON)
				.content("{\"status\":\"processing\"}")).andExpect(status().isOk());
		var executor = java.util.concurrent.Executors.newFixedThreadPool(2);
		try {
			var gate = new java.util.concurrent.CountDownLatch(1);
			java.util.concurrent.Callable<Integer> ship = () -> {
				gate.await();
				return mockMvc.perform(post(action).with(user(new AppUserDetails(admin))).contentType(MediaType.APPLICATION_JSON)
						.content("{\"status\":\"shipped\"}")).andReturn().getResponse().getStatus();
			};
			var first = executor.submit(ship);
			var second = executor.submit(ship);
			gate.countDown();
			assertThat(first.get()).isEqualTo(200);
			assertThat(second.get()).isEqualTo(200);
		} finally { executor.shutdownNow(); }
		MvcResult inbox = mockMvc.perform(get("/api/shop/notifications").with(user(new AppUserDetails(reporter))))
				.andExpect(status().isOk()).andReturn();
		JsonNode content = objectMapper.readTree(inbox.getResponse().getContentAsString()).path("content");
		assertThat(content.size()).isEqualTo(1);
		assertThat(content.get(0).path("orderId").asText()).isEqualTo(id);
	}

	@Test
	void paymentRetryDoesNotOverwriteConcurrentProcessing() throws Exception {
		String body = "{\"items\":[{\"productId\":\"" + product.getId() + "\",\"quantity\":1}],\"shippingName\":\"Buyer\",\"shippingAddress\":\"Address\"}";
		MvcResult created = mockMvc.perform(post("/api/shop/orders").with(user(new AppUserDetails(reporter)))
				.contentType(MediaType.APPLICATION_JSON).header("Idempotency-Key", "payment-race-" + System.nanoTime()).content(body))
				.andExpect(status().isCreated()).andReturn();
		String id = objectMapper.readTree(created.getResponse().getContentAsString()).get("orderId").asText();
		mockMvc.perform(post("/api/shop/payments/dev/complete/" + id).with(user(new AppUserDetails(reporter))))
				.andExpect(status().isOk());
		var staleOrder = shopOrderRepository.findByPublicId(id).orElseThrow();
		var executor = java.util.concurrent.Executors.newFixedThreadPool(2);
		try {
			var gate = new java.util.concurrent.CountDownLatch(1);
			var callback = executor.submit(() -> { gate.await(); orderService.markPaid(staleOrder, "retry"); return 0; });
			var process = executor.submit(() -> { gate.await(); return mockMvc.perform(post("/api/admin/shop/orders/" + id + "/fulfillment")
					.with(user(new AppUserDetails(admin))).contentType(MediaType.APPLICATION_JSON)
					.content("{\"status\":\"processing\"}")).andReturn().getResponse().getStatus(); });
			gate.countDown();
			assertThat(callback.get()).isZero();
			assertThat(process.get()).isEqualTo(200);
		} finally { executor.shutdownNow(); }
		assertThat(shopOrderRepository.findByPublicId(id).orElseThrow().getFulfillmentStatus())
				.isEqualTo(com.example.fixflow.domain.ShopFulfillmentStatus.processing);
		assertThat(shopOrderRepository.findByPublicId(id).orElseThrow().getPayment().getStatus())
				.isEqualTo(com.example.fixflow.domain.ShopPaymentStatus.succeeded);
		mockMvc.perform(get("/api/admin/shop/orders/" + id).with(user(new AppUserDetails(admin))))
				.andExpect(status().isOk()).andExpect(jsonPath("$.paymentStatus").value("succeeded"));
	}

	@Test
	void analyticsBucketsNewOrderByItsApiUtcDate() throws Exception {
		String body = "{\"items\":[{\"productId\":\"" + product.getId() + "\",\"quantity\":1}],\"shippingName\":\"Buyer\",\"shippingAddress\":\"Address\"}";
		MvcResult created = mockMvc.perform(post("/api/shop/orders").with(user(new AppUserDetails(reporter)))
				.contentType(MediaType.APPLICATION_JSON).header("Idempotency-Key", "date-" + System.nanoTime()).content(body))
				.andExpect(status().isCreated()).andReturn();
		String id = objectMapper.readTree(created.getResponse().getContentAsString()).path("orderId").asText();
		MvcResult detail = mockMvc.perform(get("/api/shop/orders/" + id).with(user(new AppUserDetails(reporter))))
				.andExpect(status().isOk()).andReturn();
		String date = objectMapper.readTree(detail.getResponse().getContentAsString()).path("createdAt").asText().substring(0, 10);
		MvcResult analytics = mockMvc.perform(get("/api/admin/shop/analytics").with(user(new AppUserDetails(admin))))
				.andExpect(status().isOk()).andReturn();
		JsonNode daily = objectMapper.readTree(analytics.getResponse().getContentAsString()).path("daily");
		boolean found = false;
		for (JsonNode bucket : daily) {
			if (date.equals(bucket.path("date").asText())) {
				assertThat(bucket.path("orders").asLong()).isGreaterThanOrEqualTo(1);
				found = true;
			}
		}
		assertThat(found).isTrue();
	}

}
