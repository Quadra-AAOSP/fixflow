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

	private MockMvc mockMvc;
	private User reporter;
	private User admin;
	private ShopProduct product;

	@BeforeEach
	void setUp() {
		mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
				.apply(springSecurity())
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
		reporter.setRole(UserRole.reporter);
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
}
