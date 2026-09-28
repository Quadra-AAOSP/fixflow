import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { loadCatalog } from '@/services/shop';
import { errorMessage } from '@/services/api';
import type { ShopCatalog } from '@/types/shop';

export const useShopStore = defineStore('shop', () => {
  const catalog = ref<ShopCatalog | null>(null);
  const loading = ref(false);
  const error = ref('');
  const quantities = ref<Record<string, number>>({});
  let generation = 0;
  const lines = computed(() => (catalog.value?.products ?? []).filter(p => quantities.value[p.id] > 0).map(product => ({ product, quantity: quantities.value[product.id] })));
  const count = computed(() => lines.value.reduce((sum, line) => sum + line.quantity, 0));
  const subtotal = computed(() => lines.value.reduce((sum, line) => sum + line.product.priceMinor * line.quantity, 0));
  function reset() { generation++; catalog.value = null; quantities.value = {}; loading.value = false; error.value = ''; }
  async function refresh() {
    const current = ++generation;
    loading.value = true; error.value = '';
    try {
      const result = await loadCatalog();
      if (current !== generation) return;
      if (catalog.value && (catalog.value.currency !== result.currency || catalog.value.minorUnitDigits !== result.minorUnitDigits)) quantities.value = {};
      catalog.value = result;
      quantities.value = Object.fromEntries(result.products.filter(p => quantities.value[p.id] && p.stock).map(p => [p.id, Math.min(quantities.value[p.id], p.stock)]));
    } catch (err) { if (current === generation) error.value = errorMessage(err); }
    finally { if (current === generation) loading.value = false; }
  }
  function setQuantity(id: string, quantity: number) {
    const product = catalog.value?.products.find(p => p.id === id);
    if (!product || !Number.isSafeInteger(quantity) || quantity < 0 || quantity > product.stock || error.value || loading.value) return;
    quantities.value = { ...quantities.value, [id]: quantity };
  }
  function money(amount: number) {
    if (!catalog.value) return '';
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: catalog.value.currency, minimumFractionDigits: catalog.value.minorUnitDigits, maximumFractionDigits: catalog.value.minorUnitDigits }).format(amount / 10 ** catalog.value.minorUnitDigits);
  }
  return { catalog, loading, error, quantities, lines, count, subtotal, reset, refresh, setQuantity, money };
});
