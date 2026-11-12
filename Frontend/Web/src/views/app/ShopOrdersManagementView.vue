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
  <section class="order-management live-page">
    <header class="orders-heading">
      <div>
        <RouterLink v-if="route.params.orderId" to="/shop/orders-management">{{
          t("Back to orders")
        }}</RouterLink>
        <h1>{{ t("Manage orders") }}</h1>
      </div>
      <button @click="load(0)" :disabled="loading">{{ t("Refresh") }}</button>
    </header>
    <p v-if="loading" role="status">{{ t("Loading orders…") }}</p>
    <div v-if="error" role="alert" class="orders-notice">
      <p>{{ t("Could not load or update orders.") }}</p>
      <button @click="load(0)">{{ t("Retry") }}</button>
    </div>
    <div v-if="order" class="managed-order-layout">
      <section class="order-surface order-summary">
        <h2>{{ order.orderId }}</h2>
        <dl>
          <div>
            <dt>{{ t("Payment status") }}</dt>
            <dd>{{ t(order.paymentStatus || "Not available") }}</dd>
          </div>
          <div>
            <dt>{{ t("Fulfillment status") }}</dt>
            <dd>{{ t(order.fulfillmentStatus || "Not available") }}</dd>
          </div>
          <div>
            <dt>{{ t("Total") }}</dt>
            <dd class="order-total">{{ money(order) }}</dd>
          </div>
        </dl>
        <div class="order-transitions">
          <button
            v-for="status in order.allowedTransitions"
            :key="status"
            :disabled="loading"
            @click="advance(status)"
          >
            {{
              t(status === "processing" ? "Start processing" : "Mark shipped")
            }}
          </button>
        </div>
      </section>
      <section class="order-surface order-delivery">
        <h2>{{ t("Delivery") }}</h2>
        <p>{{ order.shippingName }} · {{ order.shippingPhone }}</p>
        <p>{{ order.shippingAddress }}</p>
        <p v-if="order.deliveryConfirmedAt && order.deliverySignedName">
          {{ t("Received by") }} {{ order.deliverySignedName }} ·
          {{ order.deliveryConfirmedAt }}
        </p>
      </section>
      <section class="order-surface order-items">
        <h2>{{ t("Items") }}</h2>
        <ul>
          <li v-for="item in order.items" :key="item.productId">
            <span>{{ item.name }}</span
            ><strong>× {{ item.quantity }}</strong>
          </li>
        </ul>
      </section>
    </div>
    <section
      v-else-if="!route.params.orderId"
      class="order-surface orders-queue"
    >
      <p v-if="!loading && !error && !orders.length">
        {{ t("No orders yet.") }}
      </p>
      <ul class="managed-orders">
        <li v-for="item in orders" :key="item.orderId">
          <RouterLink
            :to="{
              name: 'shop-managed-order',
              params: { orderId: item.orderId },
            }"
            ><strong>{{ item.orderId }}</strong
            ><span class="order-state">{{
              t(item.fulfillmentStatus || "Not available")
            }}</span
            ><span class="order-amount">{{ money(item) }}</span></RouterLink
          >
        </li>
      </ul>
      <button v-if="more" :disabled="loading" @click="load(page + 1)">
        {{ t("Load more") }}
      </button>
    </section>
  </section>
</template>
<style scoped>
.order-management {
  display: grid;
  gap: 24px;
  color: #152742;
}
.orders-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}
h1 {
  font-size: 30px;
  font-weight: 750;
  letter-spacing: -0.035em;
}
h2 {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 22px;
  overflow-wrap: anywhere;
}
.orders-heading a {
  display: inline-block;
  color: #006f65;
  margin-bottom: 12px;
}
button {
  min-height: 44px;
  border: 1px solid #b9cdc7;
  padding: 10px 16px;
  border-radius: 8px;
  background: white;
  color: #006f65;
  font-weight: 650;
}
button:disabled {
  opacity: 0.5;
}
.managed-order-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}
.order-surface {
  border: 1px solid #dce5e4;
  background: white;
  padding: 26px;
  border-radius: 14px;
  min-width: 0;
}
dl {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;
}
dt {
  color: #52677b;
  font-size: 13px;
  margin-bottom: 8px;
}
dd {
  font-size: 16px;
  font-weight: 650;
}
.order-total {
  font-size: 26px;
}
.order-transitions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 26px;
  padding-top: 22px;
  border-top: 1px solid #e5ece9;
}
.order-delivery p {
  line-height: 1.7;
  margin-top: 10px;
  overflow-wrap: anywhere;
}
.order-items {
  grid-column: 1 / -1;
}
.order-items li {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 0;
  border-top: 1px solid #e5ece9;
}
.managed-orders li + li {
  border-top: 1px solid #e5ece9;
}
.managed-orders a {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 160px 140px;
  align-items: center;
  gap: 20px;
  padding: 22px 0;
}
.managed-orders strong {
  overflow-wrap: anywhere;
}
.order-state {
  font-size: 13px;
  color: #52677b;
}
.order-amount {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.orders-queue > button {
  margin-top: 20px;
}
.orders-notice {
  color: #a0434d;
}
@media (max-width: 700px) {
  .managed-order-layout {
    grid-template-columns: 1fr;
  }
  .order-items {
    grid-column: 1;
  }
  .order-surface {
    padding: 20px;
  }
  .managed-orders a {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 10px;
  }
  .order-state {
    grid-column: 1;
  }
  .order-amount {
    grid-column: 2;
    grid-row: 1 / 3;
  }
}
</style>
