<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";
import { useAuth } from "@/composables/useAuth";
import { localeTag, useLocale } from "@/i18n";
import {
  getShopAnalytics,
  type ShopAnalytics,
  type ShopRevenue,
} from "@/services/shopAdmin";
const { user } = useAuth();
const { t } = useLocale();
const data = ref<ShopAnalytics | null>(null);
const loading = ref(false);
const error = ref(false);
let generation = 0;
async function refresh() {
  const current = ++generation;
  if (
    !user.value ||
    !["shop_manager", "super_admin"].includes(user.value.role)
  ) {
    data.value = null;
    loading.value = false;
    return;
  }
  loading.value = true;
  error.value = false;
  try {
    const result = await getShopAnalytics();
    if (current === generation) data.value = result;
  } catch {
    if (current === generation) {
      data.value = null;
      error.value = true;
    }
  } finally {
    if (current === generation) loading.value = false;
  }
}
watch(
  () => [user.value?.id, user.value?.role],
  () => {
    data.value = null;
    void refresh();
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  generation++;
});
const labels: Record<string, string> = {
  pending_payment: "Pending payment",
  paid: "Paid",
  cancelled: "Cancelled",
  refunded: "Refunded",
  fulfilled: "Fulfilled",
  total: "Total",
  active: "Active",
  inStock: "In stock",
  outOfStock: "Out of stock",
};
function money(value: ShopRevenue) {
  return new Intl.NumberFormat(localeTag(), {
    style: "currency",
    currency: value.currency,
    minimumFractionDigits: value.minorUnitDigits,
    maximumFractionDigits: value.minorUnitDigits,
  }).format(value.totalMinor / 10 ** value.minorUnitDigits);
}
</script>
<template>
  <section class="shop-dashboard live-page">
    <header>
      <h1>{{ t("Shop dashboard") }}</h1>
      <button type="button" :disabled="loading" @click="refresh">
        {{ t("Refresh") }}
      </button>
    </header>
    <nav class="action-row" :aria-label="t('Shop navigation')">
      <RouterLink class="action-link" to="/shop/manage">{{
        t("Product management")
      }}</RouterLink>
      <RouterLink class="action-link" to="/shop/orders-management">{{
        t("Manage orders")
      }}</RouterLink>
    </nav>
    <p v-if="loading" role="status">{{ t("Loading shop analytics…") }}</p>
    <div v-else-if="error" role="alert">
      <p>{{ t("Could not load shop analytics.") }}</p>
      <button type="button" @click="refresh">{{ t("Retry") }}</button>
    </div>
    <div v-if="data" class="analytics-layout">
      <section class="analytics-revenue">
        <h2>{{ t("All-time revenue") }}</h2>
        <p>{{ t("Paid and fulfilled orders, including shipping and tax.") }}</p>
        <ul v-if="data.revenue.length">
          <li
            v-for="amount in data.revenue"
            :key="amount.currency + amount.minorUnitDigits"
          >
            {{ money(amount) }}
          </li>
        </ul>
        <p v-else>{{ t("No paid revenue yet.") }}</p>
      </section>
      <section class="analytics-orders">
        <h2>{{ t("Orders") }}: {{ data.totalOrders }}</h2>
        <dl>
          <div v-for="(count, status) in data.ordersByStatus" :key="status">
            <dt>{{ t(labels[status]) }}</dt>
            <dd>{{ count }}</dd>
          </div>
        </dl>
      </section>
      <section class="analytics-products">
        <h2>{{ t("Products") }}</h2>
        <dl>
          <div v-for="(count, label) in data.products" :key="label">
            <dt>{{ t(labels[label]) }}</dt>
            <dd>{{ count }}</dd>
          </div>
        </dl>
      </section>
      <section class="analytics-history">
        <h2>{{ t("Daily orders and paid revenue") }}</h2>
        <p>
          {{ t("By order creation date (UTC)") }}: {{ data.trendStartDate }} –
          {{ data.trendEndDate }}
        </p>
        <p v-if="data.daily.every((day) => day.orders === 0)">
          {{ t("No orders in this period.") }}
        </p>
        <div v-else class="trend" role="img" :aria-label="t('Order trend')">
          <div
            v-for="day in data.daily"
            :key="day.date"
            :title="`${day.date}: ${day.orders}`"
            :style="{
              height: `${(day.orders / Math.max(1, ...data.daily.map((d) => d.orders))) * 100}%`,
            }"
          ></div>
        </div>
        <p class="table-scroll-hint">{{ t("Scroll horizontally to see all columns.") }}</p>
        <div class="shop-dashboard-table" role="region" tabindex="0" :aria-label="t('Daily orders and paid revenue')">
          <table>
            <thead>
              <tr>
                <th>{{ t("Date") }}</th>
                <th>{{ t("Orders") }}</th>
                <th>{{ t("Paid revenue") }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="day in data.daily" :key="day.date">
                <td>{{ day.date }}</td>
                <td>{{ day.orders }}</td>
                <td>
                  <span
                    v-for="amount in day.revenue"
                    :key="amount.currency + amount.minorUnitDigits"
                    class="shop-dashboard-amount"
                    >{{ money(amount) }}</span
                  ><span v-if="!day.revenue.length">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </section>
</template>
<style scoped>
.table-scroll-hint { display: none; color: #52677b; font-size: 13px; margin: 8px 0; }
@media (max-width: 700px) { .table-scroll-hint { display: block; } }
.shop-dashboard {
  display: grid;
  gap: 24px;
  color: #152742;
}
.shop-dashboard > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
h1 {
  font-size: 30px;
  font-weight: 750;
  letter-spacing: -0.035em;
}
h2 {
  font-size: 17px;
  font-weight: 700;
  margin-bottom: 16px;
}
.shop-dashboard nav {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding-bottom: 24px;
  border-bottom: 1px solid #dce5e4;
}
.shop-dashboard nav a,
button {
  min-height: 44px;
  padding: 10px 16px;
  border: 1px solid #b9cdc7;
  border-radius: 8px;
  color: #006f65;
  background: white;
  font-size: 14px;
  font-weight: 650;
}
button:disabled {
  opacity: 0.5;
}
.analytics-layout {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;
}
.analytics-layout > section {
  background: white;
  border: 1px solid #dce5e4;
  border-radius: 14px;
  padding: 26px;
  min-width: 0;
}
.analytics-revenue {
  grid-column: 1 / -1;
}
.analytics-revenue ul {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  margin-top: 20px;
}
.analytics-revenue li {
  font-size: 32px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
p,
dt {
  color: #52677b;
  font-size: 14px;
  line-height: 1.6;
}
dl {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}
dl > div {
  border-top: 1px solid #e5ece9;
  padding-top: 12px;
}
dd {
  margin-top: 6px;
  font-size: 26px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.analytics-history {
  grid-column: 1 / -1;
}
.trend {
  display: flex;
  align-items: end;
  height: 120px;
  gap: 4px;
  margin: 24px 0;
  border-bottom: 1px solid #b9cdc7;
}
.trend div {
  flex: 1;
  background: #79e2cd;
  min-width: 2px;
}
.shop-dashboard-table {
  overflow-x: auto;
  margin-top: 24px;
}
table {
  border-collapse: collapse;
  width: 100%;
  min-width: 400px;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}
th,
td {
  padding: 14px 12px;
  border-bottom: 1px solid #e5ece9;
  text-align: left;
}
th {
  background: #f1f6f4;
  font-weight: 650;
}
.shop-dashboard-amount {
  display: block;
}
@media (max-width: 700px) {
  .analytics-layout {
    grid-template-columns: 1fr;
  }
  .analytics-layout > section {
    grid-column: 1;
    padding: 20px;
  }
}
</style>
