import { useCallback, useRef, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { HomeNotificationBell } from "@/components/dashboard/HomeNotificationBell";
import { Card } from "@/components/ui/Card";
import { Screen } from "@/components/ui/Screen";
import {
  loadShopAnalytics,
  type ShopAnalytics,
  type ShopAnalyticsRevenue,
} from "@/services/shop";
export function ShopDashboard() {
  const { t, i18n } = useTranslation("common");
  const router = useRouter();
  const [data, setData] = useState<ShopAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [showAllDays, setShowAllDays] = useState(false);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true);
    setError(false);
    try {
      const result = await loadShopAnalytics();
      if (current === generation.current) setData(result);
    } catch {
      if (current === generation.current) {
        setData(null);
        setError(true);
      }
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void refresh();
      return () => {
        generation.current++;
        setData(null);
      };
    }, [refresh]),
  );
  const money = (x: ShopAnalyticsRevenue) =>
    new Intl.NumberFormat(i18n.language, {
      style: "currency",
      currency: x.currency,
      minimumFractionDigits: x.minorUnitDigits,
      maximumFractionDigits: x.minorUnitDigits,
    }).format(x.totalMinor / 10 ** x.minorUnitDigits);
  return (
    <Screen>
      <ScrollView
        contentContainerClassName="p-5 gap-4"
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} />
        }
      >
        <HomeNotificationBell />
        <Text className="text-2xl font-bold text-ink">
          {t("shopDashboard.title")}
        </Text>
        <View className="flex-row gap-5">
          <Pressable
            accessibilityRole="button"
            className="min-h-[44px] justify-center"
            onPress={() => router.push("/(tabs)/more/shop-management")}
          >
            <Text className="text-ink">{t("shopDashboard.manage")}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            className="min-h-[44px] justify-center"
            onPress={() => router.push("/(tabs)/more/shop-orders")}
          >
            <Text className="text-ink">{t("orderManagement.title")}</Text>
          </Pressable>
        </View>
        {loading && (
          <Text className="text-ink">{t("shopDashboard.loading")}</Text>
        )}
        {error && (
          <Pressable
            accessibilityRole="button"
            className="min-h-[44px] justify-center"
            onPress={refresh}
          >
            <Text className="text-ink">
              {t("shopDashboard.error")} {t("shopDashboard.retry")}
            </Text>
          </Pressable>
        )}
        {data && (
          <>
            <Card>
              <Text className="text-xl font-bold text-ink">
                {t("shopDashboard.revenue")}
              </Text>
              <Text className="text-ink">
                {t("shopDashboard.revenueDescription")}
              </Text>
              {data.revenue.length ? (
                data.revenue.map((x) => (
                  <Text
                    className="text-ink"
                    key={x.currency + x.minorUnitDigits}
                  >
                    {money(x)}
                  </Text>
                ))
              ) : (
                <Text className="text-ink">{t("shopDashboard.empty")}</Text>
              )}
            </Card>
            <Card>
              <Text className="text-xl font-bold text-ink">
                {t("shopDashboard.orders")}: {data.totalOrders}
              </Text>
              {Object.entries(data.ordersByStatus).map(([key, value]) => (
                <Text className="text-ink" key={key}>
                  {t(`shopDashboard.${key}`)}: {value}
                </Text>
              ))}
            </Card>
            <Card>
              <Text className="text-xl font-bold text-ink">
                {t("shopDashboard.products")}
              </Text>
              {Object.entries(data.products).map(([key, value]) => (
                <Text className="text-ink" key={key}>
                  {t(`shopDashboard.${key}`)}: {value}
                </Text>
              ))}
            </Card>
            <Card>
              <Text className="text-xl font-bold text-ink">
                {t("shopDashboard.trend")}
              </Text>
              <Text className="text-ink">
                {t("shopDashboard.dateBasis")}: {data.trendStartDate} –{" "}
                {data.trendEndDate}
              </Text>
              <View
                className="flex-row items-end h-28 gap-px border-b border-border"
                accessible
                accessibilityLabel={`${t("shopDashboard.orderTrend")}. ${t("shopDashboard.dateBasis")}: ${data.trendStartDate} - ${data.trendEndDate}`}
              >
                {data.daily.map((day) => (
                  <View
                    key={day.date}
                    className="flex-1 bg-primary"
                    style={{
                      height: `${(day.orders / Math.max(1, ...data.daily.map((d) => d.orders))) * 100}%`,
                    }}
                  />
                ))}
              </View>
              {[...data.daily]
                .reverse()
                .slice(0, showAllDays ? undefined : 7)
                .map((day) => (
                  <View key={day.date} className="border-b border-border py-2">
                    <Text className="text-ink">
                      {day.date} - {t("shopDashboard.orders")}: {day.orders}
                    </Text>
                    <Text className="text-ink">
                      {t("shopDashboard.dailyRevenue")}:{" "}
                      {day.revenue.length
                        ? day.revenue.map(money).join(" - ")
                        : "-"}
                    </Text>
                  </View>
                ))}
              {data.daily.length > 7 && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: showAllDays }}
                  className="min-h-[44px] justify-center"
                  onPress={() => setShowAllDays(!showAllDays)}
                >
                  <Text className="text-ink">
                    {t(
                      showAllDays
                        ? "shopDashboard.showFewer"
                        : "shopDashboard.showAll",
                    )}
                  </Text>
                </Pressable>
              )}
            </Card>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
