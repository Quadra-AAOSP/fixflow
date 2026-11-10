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
  <section class="shop-dashboard dashboard-card live-page">
    <header>
      <h1>{{ t("Shop dashboard") }}</h1>
      <button type="button" :disabled="loading" @click="refresh">
        {{ t("Refresh") }}
      </button>
    </header>
    <nav class="action-row" :aria-label="t('Shop navigation')">
      <RouterLink class="action-link" to="/shop/manage">{{ t("Product management") }}</RouterLink>
      <RouterLink class="action-link" to="/shop/orders-management">{{ t("Manage orders") }}</RouterLink>
    </nav>
    <p v-if="loading" role="status">{{ t("Loading shop analytics…") }}</p>
    <div v-else-if="error" role="alert">
      <p>{{ t("Could not load shop analytics.") }}</p>
      <button type="button" @click="refresh">{{ t("Retry") }}</button>
    </div>
    <template v-if="data">
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
      <h2>{{ t("Orders") }}: {{ data.totalOrders }}</h2>
      <dl>
        <div v-for="(count, status) in data.ordersByStatus" :key="status">
          <dt>{{ t(labels[status]) }}</dt>
          <dd>{{ count }}</dd>
        </div>
      </dl>
      <h2>{{ t("Products") }}</h2>
      <dl>
        <div v-for="(count, label) in data.products" :key="label">
          <dt>{{ t(labels[label]) }}</dt>
          <dd>{{ count }}</dd>
        </div>
      </dl>
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
      <div class="shop-dashboard-table">
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
    </template>
  </section>
</template>
<style scoped>
.shop-dashboard {
  max-width: 960px;
  margin: 0 auto;
  padding: 2rem 1rem;
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
h1 {
  font-size: 1.9rem;
  font-weight: 650;
  line-height: 1.2;
}
h2 {
  margin-top: 2rem;
  font-size: 1.1rem;
  font-weight: 600;
}
.shop-dashboard > ul li {
  font-size: 1.7rem;
  font-weight: 600;
}
dl {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 0.5rem;
}
dl > div {
  padding: 0.75rem;
  border: 1px solid var(--product-border);
  background: var(--product-surface);
}
dd {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
}
.shop-dashboard-table {
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
}
th,
td {
  text-align: left;
  padding: 0.65rem;
  border-bottom: 1px solid var(--product-border);
}
.trend {
  display: flex;
  align-items: end;
  gap: 2px;
  height: 100px;
}
.trend div {
  flex: 1;
  background: var(--mint);
}
.shop-dashboard-amount {
  display: block;
}

.shop-dashboard{max-width:1200px;padding:12px 0 30px;color:var(--navy)}
.shop-dashboard header{padding:24px;border:1px solid #fbefe0;border-radius:15px;background:#fff9f1}
.shop-dashboard h1{font-size:25px;letter-spacing:-.6px}.shop-dashboard h2{margin:28px 0 8px;font-size:17px}.shop-dashboard p,.shop-dashboard dt{color:var(--muted);line-height:1.6}.shop-dashboard nav{display:flex;gap:12px;margin:18px 0;font-size:0}.shop-dashboard nav a{font-size:13px;color:var(--teal);font-weight:600;padding:10px 14px;border:1px solid var(--line);border-radius:8px;background:white}.shop-dashboard button{padding:10px 16px;background:#79e2cd;color:#104b45;border:1px solid #65d8c1;border-radius:8px;font-weight:600}.shop-dashboard button:disabled{opacity:.5}.shop-dashboard dl{gap:12px;margin-top:12px}.shop-dashboard dl>div{padding:18px;border:1px solid var(--line);border-radius:11px}.shop-dashboard dd{margin-top:8px}.shop-dashboard>ul{padding:14px 18px;border:1px solid var(--line);background:#fff;border-radius:11px}.shop-dashboard-table{margin-top:18px;border:1px solid var(--line);border-radius:11px;background:white}.shop-dashboard table{min-width:420px}.shop-dashboard th,.shop-dashboard td{padding:14px;border-color:var(--line)}.shop-dashboard thead{background:#f6f7f9}.trend{padding:12px;background:#f4f8f6;border-radius:8px}.trend div{background:#79e2cd}
@media(max-width:600px){.shop-dashboard header{padding:20px}.shop-dashboard nav{flex-wrap:wrap}}

.shop-dashboard.dashboard-card{max-width:none;margin:0;padding:24px}
.shop-dashboard button{min-height:44px;font-size:14px}
@media(max-width:650px){.shop-dashboard.dashboard-card{padding:20px 16px}}
</style>
