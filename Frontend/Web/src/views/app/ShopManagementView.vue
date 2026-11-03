<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useLocale } from '@/i18n';
import { useAuth } from '@/composables/useAuth';
import { listManagedProducts, getManagedProduct, saveManagedProduct, deactivateManagedProduct, type ManagedProduct, type ProductDraft } from '@/services/shopAdmin';
import { errorMessage } from '@/services/api';
import { safeImageUrl } from '@/services/shop';
const { user } = useAuth();
const { t } = useLocale();
const allowed = computed(() => ['shop_manager', 'super_admin'].includes(user.value?.role ?? ''));
const products = ref<ManagedProduct[]>([]);
const loading = ref(false); const busy = ref(false); const error = ref(''); const message = ref('');
const search = ref(''); const editing = ref(false); const formOpen = ref(false);
const deactivate = ref<ManagedProduct | null>(null);
const blank = (): ProductDraft => ({ id: '', name: '', description: '', category: '', brand: null, imageUrl: null, priceMinor: 0, stock: 0, active: false });
const draft = ref(blank());
const editor = ref<HTMLFormElement>();
const confirmation = ref<HTMLElement>();
async function focusEditor() { await nextTick(); editor.value?.querySelector<HTMLInputElement>('input:not([readonly])')?.focus(); }
async function requestDeactivation(product: ManagedProduct) {
  if (busy.value || loading.value) return;
  deactivate.value = product; formOpen.value = false;
  await nextTick(); confirmation.value?.focus();
}
const visible = computed(() => products.value.filter(p => `${p.id} ${p.name} ${p.category}`.toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase())));
let generation = 0;
onBeforeUnmount(() => generation++);
async function load() {
  if (!allowed.value || busy.value) return;
  const current = ++generation; loading.value = true; error.value = '';
  try { const result = await listManagedProducts(); if (current === generation) products.value = result; }
  catch (err) { if (current === generation) error.value = errorMessage(err); }
  finally { if (current === generation) loading.value = false; }
}
async function create() { if (busy.value || loading.value) return; draft.value = blank(); editing.value = false; formOpen.value = true; deactivate.value = null; error.value = ''; message.value = ''; await focusEditor(); }
async function edit(id: string) {
  if (busy.value || loading.value) return;
  const current = ++generation; busy.value = true; error.value = ''; message.value = ''; formOpen.value = false; deactivate.value = null;
  try { const result = await getManagedProduct(id); if (current === generation) { draft.value = { ...result }; editing.value = true; formOpen.value = true; } }
  catch (err) { if (current === generation) error.value = errorMessage(err); }
  finally { if (current === generation) { busy.value = false; if (formOpen.value) await focusEditor(); } }
}
async function save() {
  if (!allowed.value || busy.value) return;
  const current = ++generation; busy.value = true; error.value = ''; message.value = '';
  try {
    const result = await saveManagedProduct(draft.value, editing.value);
    if (current !== generation) return;
    products.value = [result, ...products.value.filter(p => p.id !== result.id)];
    formOpen.value = false; message.value = 'Product saved.';
  } catch (err) { if (current === generation) error.value = errorMessage(err); }
  finally { if (current === generation) busy.value = false; }
}
async function confirmDeactivation() {
  if (!allowed.value || busy.value || !deactivate.value) return;
  const current = ++generation; const id = deactivate.value.id; busy.value = true; error.value = ''; message.value = '';
  try {
    await deactivateManagedProduct(id);
    if (current !== generation) return;
    products.value = products.value.map(p => p.id === id ? { ...p, active: false } : p);
    deactivate.value = null; message.value = 'Product deactivated. Existing orders are unchanged.';
  } catch (err) { if (current === generation) error.value = errorMessage(err); }
  finally { if (current === generation) busy.value = false; }
}
onMounted(load);
</script>
<template>
  <section v-if="allowed" class="product-admin">
    <div class="product-admin-heading"><div><h1>{{ t('Product management') }}</h1><p>{{ t('Manage the live catalogue, prices and stock.') }}</p></div><button type="button" :disabled="busy || loading" @click="create">{{ t('New product') }}</button></div>
    <p v-if="error" role="alert" class="product-error">{{ t(error) }} <button type="button" :disabled="busy || loading" @click="load">{{ t('Refresh') }}</button></p>
    <p v-if="message" role="status">{{ t(message) }}</p>
    <form ref="editor" v-if="formOpen" class="product-form" @submit.prevent="save">
      <h2>{{ t(editing ? 'Edit product' : 'New product') }}</h2>
      <fieldset :disabled="busy">
        <label>{{ t('Product ID') }}<input v-model="draft.id" required maxlength="64" :readonly="editing" /></label>
        <label>{{ t('Product name') }}<input v-model="draft.name" required maxlength="255" /></label>
        <label>{{ t('Description') }}<textarea v-model="draft.description" required rows="4" /></label>
        <label>{{ t('Category') }}<input v-model="draft.category" required maxlength="128" list="product-categories" /><datalist id="product-categories"><option v-for="category in [...new Set(products.map(p => p.category))]" :key="category" :value="category" /></datalist></label>
        <label>{{ t('Brand (optional)') }}<input v-model="draft.brand" maxlength="128" /></label>
        <label>{{ t('Image URL (HTTPS, optional)') }}<input v-model="draft.imageUrl" type="url" maxlength="1024" /></label>
        <label>{{ t('Price (minor units)') }}<input v-model.number="draft.priceMinor" required type="number" min="0" max="2147483647" step="1" /></label>
        <p>{{ t('Enter the integer amount in the shop currency’s smallest unit. Currency is configured by the backend.') }}</p>
        <label>{{ t('Stock') }}<input v-model.number="draft.stock" required type="number" min="0" max="2147483647" step="1" /></label>
        <label class="product-checkbox"><input v-model="draft.active" type="checkbox" />{{ t('Active in shop') }}</label>
        <div class="product-actions"><button type="submit">{{ t(busy ? 'Saving…' : 'Save product') }}</button><button type="button" @click="formOpen = false">{{ t('Cancel') }}</button></div>
      </fieldset>
    </form>
    <section ref="confirmation" v-if="deactivate" tabindex="-1" role="region" :aria-label="t('Confirm product deactivation')" class="product-confirm">
      <p>{{ t('Deactivate {name}? It will no longer appear in the shop. You can reactivate it by editing the product.', { name: deactivate.name }) }}</p>
      <div class="product-actions"><button type="button" :disabled="busy" @click="confirmDeactivation">{{ t('Confirm deactivation') }}</button><button type="button" :disabled="busy" @click="deactivate = null">{{ t('Cancel') }}</button></div>
    </section>
    <label class="product-search">{{ t('Search products') }}<input v-model="search" type="search" /></label>
    <p v-if="loading" role="status">{{ t('Loading products…') }}</p>
    <div v-else class="product-table-wrap" tabindex="0" :aria-label="t('Product management')">
      <table class="product-table"><caption>{{ t('Product management') }}</caption><thead><tr><th scope="col">{{ t('Product name') }}</th><th scope="col">{{ t('Category') }}</th><th scope="col">{{ t('Price (minor units)') }}</th><th scope="col">{{ t('Stock') }}</th><th scope="col">{{ t('Status') }}</th><th scope="col">{{ t('Actions') }}</th></tr></thead>
        <tbody><tr v-for="product in visible" :key="product.id"><th scope="row"><div class="product-name-cell"><img v-if="safeImageUrl(product.imageUrl)" :src="safeImageUrl(product.imageUrl)!" alt="" loading="lazy" /><span>{{ product.name }}<small>{{ product.id }}</small></span></div></th><td>{{ product.category }}</td><td>{{ product.priceMinor }}</td><td>{{ product.stock }}</td><td>{{ t(product.active ? 'Active' : 'Inactive') }}</td><td><div class="product-actions"><button type="button" :disabled="busy" @click="edit(product.id)">{{ t('Edit') }}</button><button v-if="product.active" type="button" :disabled="busy" @click="requestDeactivation(product)">{{ t('Deactivate') }}</button></div></td></tr></tbody>
      </table><p v-if="!visible.length && !error">{{ t('No matching products.') }}</p>
    </div>
  </section>
</template>
<style scoped>
.product-admin{color:#233d36}.product-admin h1{font-size:26px;font-weight:750}.product-admin h2{font-size:18px;font-weight:650}.product-admin-heading,.product-actions{display:flex;gap:14px;align-items:center;justify-content:space-between;flex-wrap:wrap}.product-admin p{font-size:13px;line-height:1.7;margin:12px 0}.product-admin button{padding:10px 16px;background:#79e2cd;color:#173e35;border-radius:8px;font-size:13px}.product-admin button:disabled{opacity:.5;cursor:not-allowed}.product-form,.product-confirm{padding:22px;background:#f8f7f2;border:1px solid #d9e5dc;border-radius:14px;margin:20px 0}.product-form fieldset{display:grid;gap:16px}.product-admin label{display:grid;gap:6px;font-size:13px}.product-admin input,.product-admin textarea{min-width:0;width:100%;padding:10px 12px;border:1px solid #b6c8bf;border-radius:8px;background:#fff}.product-form .product-checkbox{display:flex;align-items:center}.product-checkbox input{width:auto}.product-admin-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,250px),1fr));gap:18px;margin-top:20px}.product-admin-grid article{border:1px solid #d9e5dc;border-radius:14px;padding:20px;overflow-wrap:anywhere}.product-admin-grid img{width:100%;height:150px;object-fit:contain}.product-admin dl{display:grid;grid-template-columns:1fr auto;gap:8px;font-size:13px;margin:16px 0}.product-error{color:#a0434d}.product-search{margin-top:22px;max-width:420px}
.product-table-wrap{overflow-x:auto;margin-top:20px}.product-table{border-collapse:collapse;width:100%;min-width:700px;font-size:14px;text-align:left}.product-table caption{text-align:left;font-weight:700;padding:12px}.product-table th,.product-table td{padding:14px 12px;border-bottom:1px solid #d9e5dc;vertical-align:middle}.product-table thead{background:#f5f8f5}.product-name-cell{display:flex;gap:12px;align-items:center}.product-name-cell img{width:48px;height:48px;object-fit:contain}.product-name-cell small{display:block;font-weight:400;color:#52677b}.product-table .product-actions{justify-content:flex-start}
</style>
