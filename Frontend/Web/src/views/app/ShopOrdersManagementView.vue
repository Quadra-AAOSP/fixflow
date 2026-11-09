<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from "vue";
import { useRoute } from "vue-router";
import { ApiError } from "@/services/api";
import { useAuth } from "@/composables/useAuth";
import { useLocale, localeTag } from "@/i18n";
import {
  listManagedOrders,
  getManagedOrder,
  advanceFulfillment,
} from "@/services/shopAdmin";
import type { ManagedShopOrder } from "@/types/shop";
const { user } = useAuth();
const { t } = useLocale();
const route = useRoute();
const orders = ref<ManagedShopOrder[]>([]);
const order = ref<ManagedShopOrder | null>(null);
function clearIfDenied(err: unknown) {
  if (err instanceof ApiError && [401, 403, 404].includes(err.status)) {
    orders.value = [];
    order.value = null;
    more.value = false;
  }
}
const loading = ref(false);
const error = ref(false);
const more = ref(false);
const page = ref(0);
let generation = 0;
async function load(next = 0) {
  const current = ++generation;
  if (
    !user.value ||
    !["shop_manager", "super_admin"].includes(user.value.role)
  ) {
    orders.value = [];
    order.value = null;
    return;
  }
  loading.value = true;
  error.value = false;
  try {
    const id = route.params.orderId;
    if (typeof id === "string") {
      const result = await getManagedOrder(id);
      if (current === generation) order.value = result;
    } else {
      const result = await listManagedOrders(next);
      if (current === generation) {
        orders.value = next
          ? [...orders.value, ...result.content]
          : result.content;
        more.value = result.hasMore;
        page.value = next;
      }
    }
  } catch (err) {
    if (current === generation) {
      clearIfDenied(err);
      error.value = true;
    }
  } finally {
    if (current === generation) loading.value = false;
  }
}
async function advance(status: "processing" | "shipped") {
  if (!order.value || loading.value) return;
  const current = ++generation;
  loading.value = true;
  error.value = false;
  try {
    const result = await advanceFulfillment(order.value.orderId, status);
    if (current === generation) order.value = result;
  } catch (err) {
    if (current === generation) {
      clearIfDenied(err);
      error.value = true;
    }
  } finally {
    if (current === generation) loading.value = false;
  }
}
watch(
  () => [user.value?.id, user.value?.role, route.params.orderId],
  () => {
    orders.value = [];
    order.value = null;
    void load();
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  generation++;
});
function money(o: ManagedShopOrder) {
  return new Intl.NumberFormat(localeTag(), {
    style: "currency",
    currency: o.currency,
    minimumFractionDigits: o.minorUnitDigits,
    maximumFractionDigits: o.minorUnitDigits,
  }).format(o.totalMinor / 10 ** o.minorUnitDigits);
}
</script>
<template>
  <section class="order-management">
    <h1>{{ t("Manage orders") }}</h1>
    <RouterLink v-if="route.params.orderId" to="/shop/orders-management">{{
      t("Back to orders")
    }}</RouterLink
    ><button @click="load(0)" :disabled="loading">{{ t("Refresh") }}</button>
    <p v-if="loading" role="status">{{ t("Loading orders…") }}</p>
    <p v-if="error" role="alert">
      {{ t("Could not load or update orders.") }}
      <button @click="load(0)">{{ t("Retry") }}</button>
    </p>
    <template v-if="order"
      ><h2>{{ order.orderId }}</h2>
      <p>
        {{ t("Payment status") }}:
        {{ t(order.paymentStatus || "Not available") }}
      </p>
      <p>
        {{ t("Fulfillment status") }}:
        {{ t(order.fulfillmentStatus || "Not available") }}
      </p>
      <p>{{ money(order) }}</p>
      <p>{{ order.shippingName }} · {{ order.shippingPhone }}</p>
      <p>{{ order.shippingAddress }}</p>
      <p v-if="order.deliveryConfirmedAt && order.deliverySignedName">
        {{ t("Received by") }} {{ order.deliverySignedName }} ·
        {{ order.deliveryConfirmedAt }}
      </p>
      <ul>
        <li v-for="item in order.items" :key="item.productId">
          {{ item.quantity }} × {{ item.name }}
        </li>
      </ul>
      <button
        v-for="status in order.allowedTransitions"
        :key="status"
        :disabled="loading"
        @click="advance(status)"
      >
        {{ t(status === "processing" ? "Start processing" : "Mark shipped") }}
      </button></template
    >
    <template v-else-if="!route.params.orderId"
      ><p v-if="!loading && !error && !orders.length">
        {{ t("No orders yet.") }}
      </p>
      <ul class="managed-orders">
        <li v-for="item in orders" :key="item.orderId">
          <RouterLink
            :to="{
              name: 'shop-managed-order',
              params: { orderId: item.orderId },
            }"
            >{{ item.orderId }}</RouterLink
          >
          · {{ t(item.fulfillmentStatus || "Not available") }} ·
          {{ money(item) }}
        </li>
      </ul>
      <button v-if="more" :disabled="loading" @click="load(page + 1)">
        {{ t("Load more") }}
      </button></template
    >
  </section>
</template>
<style scoped>
.order-management {
  max-width: 900px;
  margin: auto;
  padding: 2rem;
  color: var(--product-ink);
}
h1 {
  font-size: 1.9rem;
  font-weight: 650;
}
h2 {
  font-size: 1.2rem;
  font-weight: 600;
}
p,
li {
  margin: 0.75rem 0;
}
button {
  padding: 0.6rem;
  margin: 0.3rem;
  background: var(--mint);
  color: var(--product-ink);
  border-radius: 8px;
}
a {
  text-decoration: underline;
}

.order-management{max-width:1200px;padding:12px 0 30px;color:var(--navy)}.order-management h1{padding:24px;border:1px solid #fbefe0;border-radius:15px;background:#fff9f1;font-size:25px;letter-spacing:-.6px;margin-bottom:18px}.order-management h2{margin-top:22px}.order-management p{color:var(--muted)}.order-management button{padding:10px 16px;background:#79e2cd;color:#104b45;border:1px solid #65d8c1;border-radius:8px;font-size:13px;font-weight:600}.order-management button:disabled{opacity:.5;cursor:not-allowed}.order-management a{color:var(--teal);font-weight:600}.managed-orders{display:grid;gap:10px;margin-top:20px}.managed-orders li{margin:0;padding:18px;border:1px solid var(--line);border-radius:11px;background:#fff;color:var(--muted)}.managed-orders li a{display:inline-block;margin-right:8px;overflow-wrap:anywhere}.order-management [role=alert]{padding:14px;background:#fff1f1;border-radius:8px;color:#a0434d}
</style>
