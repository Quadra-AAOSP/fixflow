<script setup lang="ts">
import LoadingStatus from "@/components/ui/LoadingStatus.vue";

import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";

import { useRoute } from "vue-router";

import { useAuthStore } from "@/stores/auth";

import { useLocale, localeTag } from "@/i18n";

import { getOrder, cancelOrder, confirmDelivery } from "@/services/shop";

import { errorMessage } from "@/services/api";

import { formatDate, humanize } from "@/utils/maintenance";

import type { ShopOrder } from "@/types/shop";

const auth = useAuthStore();
const route = useRoute();
const { t } = useLocale();

const id = computed(() => String(route.params.orderId ?? ""));

const order = ref<ShopOrder | null>(null);
const loading = ref(false);
const busy = ref(false);

const error = ref("");
const actionError = ref("");
const confirming = ref(false);
const statusSummary = ref<HTMLElement>();
const actionNotice = ref("");

const signedName = ref("");
const received = ref(false);

let generation = 0;
onBeforeUnmount(() => generation++);

function money(amount: number) {
  if (!order.value) return "";

  return new Intl.NumberFormat(localeTag(), {
    style: "currency",
    currency: order.value.currency,
    minimumFractionDigits: order.value.minorUnitDigits,
    maximumFractionDigits: order.value.minorUnitDigits,
  }).format(amount / 10 ** order.value.minorUnitDigits);
}

async function load() {
  const current = ++generation;
  signedName.value = "";
  received.value = false;
  order.value = null;
  error.value = "";
  actionError.value = "";
  actionNotice.value = "";
  confirming.value = false;
  loading.value = false;
  busy.value = false;

  if (!auth.user || !id.value) return;

  loading.value = true;

  try {
    const result = await getOrder(id.value);

    if (current !== generation) return;

    if (result.orderId !== id.value)
      throw new Error("The order response did not match the requested order.");

    order.value = result;
  } catch (err) {
    if (current === generation) error.value = errorMessage(err);
  } finally {
    if (current === generation) loading.value = false;
  }
}

async function cancel() {
  if (
    !auth.user ||
    busy.value ||
    !confirming.value ||
    order.value?.status !== "pending_payment"
  )
    return;

  const current = generation;
  const orderId = order.value.orderId;
  busy.value = true;
  actionError.value = "";

  try {
    const result = await cancelOrder(orderId);
    if (current !== generation) return;

    if (result.orderId !== orderId)
      throw new Error("The order response did not match the requested order.");

    order.value = result;
    confirming.value = false;
    actionNotice.value = "Order cancelled.";
    await nextTick();
    if (current === generation) statusSummary.value?.focus();
  } catch (err) {
    if (current === generation) actionError.value = errorMessage(err);
  } finally {
    if (current === generation) busy.value = false;
  }
}

async function receipt() {
  if (
    !order.value?.canConfirmDelivery ||
    !signedName.value.trim() ||
    signedName.value.trim().length > 160 ||
    !received.value ||
    busy.value
  )
    return;

  const current = generation;
  busy.value = true;
  actionError.value = "";

  try {
    const result = await confirmDelivery(
      order.value.orderId,
      signedName.value.trim(),
    );
    if (current === generation) {
      order.value = result;
      actionNotice.value = "Delivery confirmed.";
      await nextTick();
      if (current === generation) statusSummary.value?.focus();
    }
  } catch (err) {
    if (current === generation) actionError.value = errorMessage(err);
  } finally {
    if (current === generation) busy.value = false;
  }
}

watch([id, () => auth.user?.id, () => auth.user?.role], load, {
  immediate: true,
});
</script>

<template>
  <div class="order-page">
    <header class="order-header">
      <div>
        <RouterLink to="/shop" class="text-action"
          >← {{ t("Back to shop") }}</RouterLink
        >
        <h1>{{ t("Order details") }}</h1>
        <p v-if="order">{{ order.orderId }}</p>
      </div>
      <button
        type="button"
        class="action-link"
        :disabled="busy || loading"
        @click="load"
      >
        {{ t("Refresh order") }}
      </button>
    </header>
    <LoadingStatus v-if="loading" :label="t('Loading order…')" />
    <p v-else-if="error" role="alert" class="order-error">
      {{ t(error) }}
      <button class="text-action" @click="load">{{ t("Retry") }}</button>
    </p>
    <template v-else-if="order"
      ><p v-if="actionNotice" role="status" aria-live="polite">{{ t(actionNotice) }}</p>
      <div ref="statusSummary" tabindex="-1" :aria-label="t('Order status')" class="order-status dashboard-card">
        <div>
          <span>{{ t("Status") }}</span
          ><strong>{{ t(humanize(order.status)) }}</strong>
        </div>
        <div>
          <span>{{ t("Payment status") }}</span
          ><strong>{{
            order.paymentStatus
              ? t(humanize(order.paymentStatus))
              : t("Not available")
          }}</strong>
        </div>
        <div>
          <span>{{ t("Created") }}</span
          ><strong>{{ formatDate(order.createdAt, true) }}</strong>
        </div>
        <div>
          <span>{{ t("Updated") }}</span
          ><strong>{{ formatDate(order.updatedAt, true) }}</strong>
        </div>
      </div>
      <div class="order-layout">
        <section class="dashboard-card order-items-panel">
          <h2>{{ t("Order items") }}</h2>
          <ul class="order-items">
            <li
              v-for="(item, index) in order.items"
              :key="item.productId + index"
            >
              <div>
                <strong>{{ item.name }}</strong>
                <p>
                  {{
                    t("{quantity} × {price}", {
                      quantity: item.quantity,
                      price: money(item.unitPriceMinor),
                    })
                  }}
                </p>
              </div>
              <strong>{{ money(item.lineTotalMinor) }}</strong>
            </li>
          </ul>
          <dl class="order-totals">
            <div>
              <dt>{{ t("Subtotal") }}</dt>
              <dd>{{ money(order.subtotalMinor) }}</dd>
            </div>
            <div>
              <dt>{{ t("Shipping") }}</dt>
              <dd>{{ money(order.shippingMinor) }}</dd>
            </div>
            <div>
              <dt>{{ t("Tax") }}</dt>
              <dd>{{ money(order.taxMinor) }}</dd>
            </div>
            <div>
              <dt>{{ t("Order total") }}</dt>
              <dd>
                <strong>{{ money(order.totalMinor) }}</strong>
              </dd>
            </div>
          </dl>
        </section>
        <aside class="order-side">
          <section class="dashboard-card">
            <h2>{{ t("Fulfillment status") }}</h2>
            <p>{{ t(order.fulfillmentStatus ? humanize(order.fulfillmentStatus) : "Not available") }}</p>
            <p v-if="order.deliveryConfirmedAt">
              {{ t("Received by") }} {{ order.deliverySignedName }} ·
              {{ formatDate(order.deliveryConfirmedAt, true) }}
            </p>
            <form v-if="order.canConfirmDelivery" @submit.prevent="receipt">
              <label
                >{{ t("Your name") }}
                <input v-model="signedName" required maxlength="160" /></label
              ><label
                ><input v-model="received" type="checkbox" required />
                {{ t("I received this order") }}</label
              ><button
                class="action-link"
                :disabled="
                  busy ||
                  !received ||
                  !signedName.trim() ||
                  signedName.trim().length > 160
                "
              >
                {{ t("Confirm delivery") }}
              </button>
            </form>
            <p v-if="actionError" role="alert" class="order-error">
              {{ t(actionError) }}
            </p>
          </section>
          <section class="dashboard-card">
            <h2>{{ t("Delivery details") }}</h2>
            <p>{{ order.shippingName }}</p>
            <p v-if="order.shippingPhone">{{ order.shippingPhone }}</p>
            <p class="order-address">{{ order.shippingAddress }}</p>
          </section>
          <section
            v-if="order.status === 'pending_payment'"
            class="dashboard-card"
          >
            <p v-if="actionError" role="alert" class="order-error">
              {{ t(actionError) }}
            </p>
            <button
              v-if="!confirming"
              class="text-action"
              type="button"
              @click="confirming = true"
            >
              {{ t("Cancel order") }}
            </button>
            <div v-else>
              <p>
                {{
                  t(
                    "Cancel this unpaid order? Its stock reservation will be released. You will need a new order to purchase these items later.",
                  )
                }}
              </p>
              <div class="order-actions">
                <button
                  class="action-link"
                  type="button"
                  :disabled="busy"
                  @click="cancel"
                >
                  {{
                    t(busy ? "Cancelling…" : "Confirm order cancellation")
                  }}</button
                ><button
                  class="text-action"
                  type="button"
                  :disabled="busy"
                  @click="confirming = false"
                >
                  {{ t("Keep order") }}
                </button>
              </div>
            </div>
          </section>
        </aside>
      </div></template
    >
  </div>
</template>
<style scoped>
.order-page {
  display: grid;
  gap: 24px;
}
.order-header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 20px;
  border-bottom: 1px solid #e0e9e4;
  padding: 8px 0 24px;
}
.order-header h1 {
  font-size: 32px;
  font-weight: 700;
  letter-spacing: -0.03em;
  margin-top: 16px;
}
.order-header p {
  color: #52677b;
  overflow-wrap: anywhere;
}
.order-status {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  padding: 20px;
}
.order-status div {
  display: grid;
  gap: 6px;
  min-width: 0;
}
.order-status span {
  color: #52677b;
  font-size: 12px;
}
.order-status strong {
  overflow-wrap: anywhere;
}
.order-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(280px, 0.7fr);
  gap: 18px;
  align-items: start;
}
.order-layout .dashboard-card {
  padding: 22px;
}
.order-layout h2 {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 16px;
}
.order-side {
  display: grid;
  gap: 16px;
}
.order-side p {
  line-height: 1.6;
  margin: 8px 0;
}
.order-side form {
  display: grid;
  gap: 12px;
  margin-top: 16px;
}
.order-side input:not([type="checkbox"]) {
  width: 100%;
  border: 1px solid #cbdad2;
  border-radius: 8px;
  padding: 10px;
}
.order-items li,
.order-totals div {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 13px 0;
  border-bottom: 1px solid #e8efeb;
}
.order-items p {
  color: #52677b;
  margin-top: 4px;
}
.order-totals {
  margin-top: 18px;
}
.order-totals div:last-child {
  font-size: 16px;
  border: 0;
}
.order-address {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.order-error {
  color: #a0434d;
}
.order-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 14px;
}
@media (max-width: 750px) {
  .order-layout {
    grid-template-columns: 1fr;
  }
  .order-status {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .order-header {
    align-items: start;
    flex-direction: column;
  }
}
</style>
