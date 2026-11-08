package com.example.fixflow.web;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.fixflow.domain.ShopOrderStatus;
import com.example.fixflow.domain.UserRole;
import com.example.fixflow.repository.ShopOrderRepository;
import com.example.fixflow.repository.ShopProductRepository;
import com.example.fixflow.security.AppUserDetails;

@RestController
@RequestMapping("/api/admin/shop/analytics")
public class ShopAnalyticsController {
	private static final List<ShopOrderStatus> REVENUE_STATUSES = List.of(ShopOrderStatus.paid, ShopOrderStatus.fulfilled);
	private final ShopOrderRepository orders;
	private final ShopProductRepository products;

	public ShopAnalyticsController(ShopOrderRepository orders, ShopProductRepository products) {
		this.orders = orders;
		this.products = products;
	}

	@GetMapping
	@Transactional(readOnly = true)
	public Analytics analytics(@AuthenticationPrincipal AppUserDetails principal) {
		if (principal == null) {
			throw new ApiException(401, "Authentication required");
		}
		if (principal.getRole() != UserRole.shop_manager && principal.getRole() != UserRole.super_admin) {
			throw new ApiException(403, "Shop manager access required");
		}
		Instant now = Instant.now();
		LocalDate end = now.atZone(ZoneOffset.UTC).toLocalDate();
		LocalDate start = end.minusDays(29);
		Map<String, Long> statuses = new LinkedHashMap<>();
		Arrays.stream(ShopOrderStatus.values()).forEach(status -> statuses.put(status.name(), 0L));
		orders.countByStatus().forEach(row -> statuses.put(((ShopOrderStatus) row[0]).name(), (Long) row[1]));
		long total = statuses.values().stream().mapToLong(Long::longValue).sum();
		List<Object[]> groups = orders.dailyGroups(start.atStartOfDay(ZoneOffset.UTC).toInstant(),
				end.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant());
		List<Daily> daily = start.datesUntil(end.plusDays(1)).map(date -> {
			long count = 0;
			Map<String, Money> totals = new LinkedHashMap<>();
			for (Object[] row : groups) {
				LocalDate groupDate = LocalDate.of(((Number) row[0]).intValue(), ((Number) row[1]).intValue(), ((Number) row[2]).intValue());
				if (!date.equals(groupDate)) {
					continue;
				}
				count += (Long) row[6];
				if (REVENUE_STATUSES.contains((ShopOrderStatus) row[3])) {
					String currency = (String) row[4];
					int digits = (Integer) row[5];
					String key = currency + ":" + digits;
					Money previous = totals.get(key);
					totals.put(key, new Money(currency, digits, (Long) row[7] + (previous == null ? 0 : previous.totalMinor())));
				}
			}
			return new Daily(date, count, new ArrayList<>(totals.values()));
		}).toList();
		return new Analytics(now, start, end, total, statuses, money(orders.revenue(REVENUE_STATUSES)),
				new Products(products.count(), products.countByActiveTrue(), products.countByActiveTrueAndStockGreaterThan(0),
						products.countByActiveTrueAndStockLessThanEqual(0)), daily);
	}

	private static List<Money> money(List<Object[]> rows) {
		return rows.stream().map(row -> new Money((String) row[0], (Integer) row[1], (Long) row[2])).toList();
	}

	public record Money(String currency, int minorUnitDigits, long totalMinor) { }
	public record Daily(LocalDate date, long orders, List<Money> revenue) { }
	public record Products(long total, long active, long inStock, long outOfStock) { }
	public record Analytics(Instant generatedAt, LocalDate trendStartDate, LocalDate trendEndDate, long totalOrders,
			Map<String, Long> ordersByStatus, List<Money> revenue, Products products, List<Daily> daily) { }
}
