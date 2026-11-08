<script setup lang="ts">
import LoadingStatus from '@/components/ui/LoadingStatus.vue';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useLocale, localeTag } from '@/i18n';
import { getOrder, cancelOrder } from '@/services/shop';
import { errorMessage } from '@/services/api';
import { formatDate } from '@/utils/maintenance';
import type { ShopOrder } from '@/types/shop';
const auth = useAuthStore(); const route = useRoute(); const { t } = useLocale();
const id = computed(() => String(route.params.orderId ?? ''));
const order = ref<ShopOrder | null>(null); const loading = ref(false); const busy = ref(false);
const error = ref(''); const actionError = ref(''); const confirming = ref(false);
let generation = 0; onBeforeUnmount(() => generation++);
function money(amount: number) {
  if (!order.value) return '';
  return new Intl.NumberFormat(localeTag(), { style: 'currency', currency: order.value.currency, minimumFractionDigits: order.value.minorUnitDigits, maximumFractionDigits: order.value.minorUnitDigits }).format(amount / 10 ** order.value.minorUnitDigits);
}
async function load() {
  const current = ++generation; order.value = null; error.value = ''; actionError.value = ''; confirming.value = false; loading.value = false; busy.value = false;
  if (!auth.user || !id.value) return;
  loading.value = true;
  try {
    const result = await getOrder(id.value);
    if (current !== generation) return;
    if (result.orderId !== id.value) throw new Error('The order response did not match the requested order.');
    order.value = result;
  } catch (err) { if (current === generation) error.value = errorMessage(err); }
  finally { if (current === generation) loading.value = false; }
}
async function cancel() {
  if (!auth.user || busy.value || !confirming.value || order.value?.status !== 'pending_payment') return;
  const current = generation; const orderId = order.value.orderId; busy.value = true; actionError.value = '';
  try {
    const result = await cancelOrder(orderId); if (current !== generation) return;
    if (result.orderId !== orderId) throw new Error('The order response did not match the requested order.');
    order.value = result; confirming.value = false;
  } catch (err) { if (current === generation) actionError.value = errorMessage(err); }
  finally { if (current === generation) busy.value = false; }
}
watch([id, () => auth.user?.id, () => auth.user?.role], load, { immediate: true });
</script>
<template>
  <section class="order-detail">
    <div class="order-heading"><RouterLink to="/shop">{{ t('Back to shop') }}</RouterLink><button type="button" :disabled="busy || loading" @click="load">{{ t('Refresh order') }}</button></div>
    <h1>{{ t('Order details') }}</h1>
    <LoadingStatus v-if="loading" :label="t('Loading order…')" /><p v-else-if="error" role="alert" class="order-error">{{ t(error) }}</p>
    <template v-else-if="order">
      <p class="order-id">{{ order.orderId }}</p>
      <dl><dt>{{ t('Status') }}</dt><dd>{{ t(order.status.replaceAll('_', ' ')) }}</dd><dt>{{ t('Payment status') }}</dt><dd>{{ order.paymentStatus ? t(order.paymentStatus.replaceAll('_', ' ')) : t('Not available') }}</dd><dt>{{ t('Created') }}</dt><dd>{{ formatDate(order.createdAt, true) }}</dd><dt>{{ t('Updated') }}</dt><dd>{{ formatDate(order.updatedAt, true) }}</dd></dl>
      <section><h2>{{ t('Order items') }}</h2><ul class="order-items"><li v-for="(item, index) in order.items" :key="item.productId + index"><div><strong>{{ item.name }}</strong><p>{{ t('{quantity} × {price}', { quantity: item.quantity, price: money(item.unitPriceMinor) }) }}</p></div><strong>{{ money(item.lineTotalMinor) }}</strong></li></ul></section>
      <dl><dt>{{ t('Subtotal') }}</dt><dd>{{ money(order.subtotalMinor) }}</dd><dt>{{ t('Shipping') }}</dt><dd>{{ money(order.shippingMinor) }}</dd><dt>{{ t('Tax') }}</dt><dd>{{ money(order.taxMinor) }}</dd><dt>{{ t('Order total') }}</dt><dd><strong>{{ money(order.totalMinor) }}</strong></dd></dl>
      <section><h2>{{ t('Delivery details') }}</h2><p>{{ order.shippingName }}</p><p v-if="order.shippingPhone">{{ order.shippingPhone }}</p><p class="order-address">{{ order.shippingAddress }}</p></section>
      <section v-if="order.status === 'pending_payment'">
        <p v-if="actionError" role="alert" class="order-error">{{ t(actionError) }}</p>
        <button v-if="!confirming" type="button" @click="confirming = true">{{ t('Cancel order') }}</button>
        <div v-else><p>{{ t('Cancel this unpaid order? Its stock reservation will be released. You will need a new order to purchase these items later.') }}</p><div class="order-actions"><button type="button" :disabled="busy" @click="cancel">{{ t(busy ? 'Cancelling…' : 'Confirm order cancellation') }}</button><button type="button" :disabled="busy" @click="confirming = false">{{ t('Keep order') }}</button></div></div>
      </section>
    </template>
  </section>
</template>
<style scoped>
.order-detail{color:#233d36;max-width:850px;margin:auto}.order-detail h1{font-size:28px;font-weight:750;margin:24px 0 12px}.order-detail h2{font-size:19px;font-weight:650;margin-bottom:16px}.order-detail p{font-size:14px;line-height:1.8;margin:8px 0}.order-heading,.order-actions{display:flex;gap:16px;justify-content:space-between;align-items:center;flex-wrap:wrap}.order-detail button{background:#79e2cd;color:#173e35;padding:10px 16px;border-radius:8px;font-size:13px}.order-detail button:disabled{opacity:.5}.order-detail section{border-top:1px solid #dce7df;padding:24px 0}.order-detail dl{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px 20px;margin:24px 0;font-size:14px}.order-detail dd{text-align:right;overflow-wrap:anywhere}.order-items{display:grid;gap:16px}.order-items li{display:flex;justify-content:space-between;gap:18px;flex-wrap:wrap;border:1px solid #dce7df;padding:18px;border-radius:10px;font-size:14px}.order-id,.order-address{overflow-wrap:anywhere;white-space:pre-wrap}.order-error{color:#a0434d}
</style>
