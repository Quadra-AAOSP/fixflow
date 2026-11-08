<script setup lang="ts">
import LoadingStatus from '@/components/ui/LoadingStatus.vue';
import { localeTag, useLocale } from '@/i18n';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  ArrowUpRight, ArrowRight, ShoppingBag, Search, Plus, Minus, X, Package,
  SlidersHorizontal, RefreshCw,
} from '@lucide/vue';
import { useShopStore } from '@/stores/shop';
import { useAuthStore } from '@/stores/auth';
import {
  catalogPath,
  completeDevPayment,
  createOrder,
  listOrders,
  quoteCheckout,
} from '@/services/shop';
import { errorMessage } from '@/services/api';
import ProductImage from '@/components/shop/ProductImage.vue';
import type { ShopOrder, ShopQuote } from '@/types/shop';
import '@/styles/shop.css';
const { t } = useLocale();

const shop = useShopStore();
const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const query = ref('');
const category = ref('');
const sort = ref('name');
const availableOnly = ref(false);
const detailId = ref<string | null>(null);
const detail = ref<HTMLDialogElement>();
const basket = ref<HTMLDialogElement>();
const ordersDialog = ref<HTMLDialogElement>();
const announcement = ref<{ key: string; values: Record<string, string | number> } | null>(null);
const announcementText = computed(() => announcement.value ? t(announcement.value.key, announcement.value.values) : '');
const checkoutBusy = ref(false);
const checkoutError = ref('');
const shippingName = ref('');
const shippingPhone = ref('');
const shippingAddress = ref('');
const quote = ref<ShopQuote | null>(null);
const orders = ref<ShopOrder[]>([]);
const ordersError = ref('');
const ordersLoading = ref(false);
let disposed = false;
let quoteVersion = 0;
let ordersVersion = 0;
let checkoutAttempt: { fingerprint: string; key: string } | null = null;
onBeforeUnmount(() => { disposed = true; quoteVersion++; ordersVersion++; });

const categories = computed(() => [...new Set(shop.catalog?.products.map(p => p.category) ?? [])].sort());
const selected = computed(() => shop.catalog?.products.find(p => p.id === detailId.value));
const products = computed(() => (shop.catalog?.products ?? []).filter(p => {
  return (!category.value || p.category === category.value) && (!availableOnly.value || p.stock > 0)
    && `${p.name} ${p.brand ?? ''} ${p.description} ${p.category}`.toLowerCase().includes(query.value.trim().toLowerCase());
}).sort((a, b) => sort.value === 'price-low' ? a.priceMinor - b.priceMinor : sort.value === 'price-high' ? b.priceMinor - a.priceMinor : a.name.localeCompare(b.name)));
const ready = computed(() => !!shop.catalog && !shop.error && !shop.loading);
const cartItems = computed(() => shop.lines.map(line => ({ productId: line.product.id, quantity: line.quantity })));

function money(amount: number, currency = shop.catalog?.currency, digits = shop.catalog?.minorUnitDigits) {
  if (!currency || digits == null) return shop.money(amount);
  return new Intl.NumberFormat(localeTag(), {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount / 10 ** digits);
}

function add(id: string) {
  const product = shop.catalog?.products.find(item => item.id === id);
  if (!product) return;
  const before = shop.quantities[id] || 0;
  shop.setQuantity(id, before + 1);
  if (shop.quantities[id] > before) {
    announcement.value = { key: '{name} added to your basket. {count} items in basket.', values: { name: product.name, count: shop.count } };
  }
}
async function inspect(id: string) { detailId.value = id; await nextTick(); detail.value?.showModal(); }
function clearFilters() { query.value = ''; category.value = ''; availableOnly.value = false; sort.value = 'name'; }

async function refreshQuote() {
  const current = ++quoteVersion;
  const actorId = auth.user?.id;
  quote.value = null;
  checkoutError.value = '';
  if (!auth.isAuthenticated || auth.user?.role === 'shop_manager' || !cartItems.value.length) return;
  try {
    const result = await quoteCheckout(cartItems.value);
    if (!disposed && current === quoteVersion && actorId === auth.user?.id) quote.value = result;
  } catch (err) {
    if (!disposed && current === quoteVersion && actorId === auth.user?.id) checkoutError.value = errorMessage(err);
  }
}

async function placeOrder() {
  if (checkoutBusy.value || auth.user?.role === 'shop_manager' || !cartItems.value.length) return;
  const actorId = auth.user?.id;
  checkoutError.value = '';
  if (!auth.isAuthenticated) {
    checkoutError.value = 'Sign in to checkout.';
    return;
  }
  if (!shippingName.value.trim() || !shippingAddress.value.trim()) {
    checkoutError.value = 'Name and shipping address are required.';
    return;
  }
  checkoutBusy.value = true;
  try {
    const payload = {
      items: cartItems.value,
      shippingName: shippingName.value.trim(),
      shippingPhone: shippingPhone.value.trim() || undefined,
      shippingAddress: shippingAddress.value.trim(),
    };
    const fingerprint = JSON.stringify({ actorId, ...payload });
    if (checkoutAttempt?.fingerprint !== fingerprint) checkoutAttempt = { fingerprint, key: crypto.randomUUID() };
    const result = await createOrder({ ...payload, idempotencyKey: checkoutAttempt.key });
    checkoutAttempt = null;
    if (disposed || actorId !== auth.user?.id) return;
    shop.clearBasket();
    quote.value = null;
    announcement.value = { key: 'Order {id} created.', values: { id: result.orderId } };
    if (result.checkoutUrl) {
      if (result.paymentProvider === 'dev') {
        await completeDevPayment(result.orderId);
        if (disposed || actorId !== auth.user?.id) return;
        announcement.value = { key: 'Order {id} paid (dev checkout).', values: { id: result.orderId } };
        await loadOrders();
        basket.value?.close();
        ordersDialog.value?.showModal();
      } else {
        window.location.href = result.checkoutUrl;
      }
    }
  } catch (err) {
    if (disposed || actorId !== auth.user?.id) return;
    checkoutError.value = errorMessage(err);
    await shop.refresh();
  } finally {
    checkoutBusy.value = false;
  }
}

async function loadOrders() {
  const current = ++ordersVersion;
  const actorId = auth.user?.id;
  if (!auth.isAuthenticated) {
    orders.value = [];
    return;
  }
  ordersLoading.value = true;
  ordersError.value = '';
  try {
    const result = await listOrders();
    if (!disposed && current === ordersVersion && actorId === auth.user?.id) orders.value = result;
  } catch (err) {
    if (!disposed && current === ordersVersion && actorId === auth.user?.id) ordersError.value = errorMessage(err);
  } finally {
    if (!disposed && current === ordersVersion) ordersLoading.value = false;
  }
}

async function openOrders() {
  await loadOrders();
  ordersDialog.value?.showModal();
}

watch(() => auth.user?.role, role => { if (role === 'shop_manager') { quoteVersion++; quote.value = null; basket.value?.close(); void router.replace('/shop/orders-management'); } }, { immediate: true });
watch(cartItems, () => { void refreshQuote(); }, { deep: true });
watch(() => auth.isAuthenticated, (ok) => {
  if (ok) {
    shippingName.value = [auth.user?.firstName, auth.user?.lastName].filter(Boolean).join(' ');
    shippingPhone.value = auth.user?.phone ?? '';
    shippingAddress.value = auth.user?.address ?? '';
    void refreshQuote();
  } else {
    checkoutAttempt = null; quoteVersion++; ordersVersion++; quote.value = null; orders.value = [];
    shippingName.value = ''; shippingPhone.value = ''; shippingAddress.value = '';
    ordersDialog.value?.close(); basket.value?.close();
  }
}, { immediate: true });

onMounted(async () => {
  await auth.hydrate();
  if (!shop.catalog) await shop.refresh();
  const orderId = typeof route.query.orderId === 'string' ? route.query.orderId : '';
  if (orderId && auth.isAuthenticated) {
    await router.replace({ name: 'shop-order', params: { orderId } });
  }
});
</script>

<template>
  <div class="fixflow-shop">
    <div class="shop-titlebar">
      <div>
        <span class="shop-eyebrow">{{ t("THE FIXFLOW SHOP") }}</span>
        <h1>{{ t("A little care starts here.") }}</h1>
      </div>
      <div class="shop-titlebar-actions">
        <button v-if="auth.isAuthenticated" class="shop-secondary" type="button" @click="openOrders">{{ t("Orders") }}</button>
        <button class="shop-basket-button" type="button" :aria-label="t('Your basket: {count} items', { count: shop.count })" @click="basket?.showModal()">
          <ShoppingBag :size="19" />{{ t("Your basket") }}<span>{{ shop.count }}</span>
        </button>
      </div>
    </div>
    <section class="shop-hero">
      <div class="shop-hero-copy">
        <span class="shop-pill"><span /> {{ t("FOR THE SPACES YOU CARE FOR") }}</span>
        <h2>{{ t('Small fixes.') }}<br /><em>{{ t('Big possibilities.') }}</em></h2>
        <p>{{ t("Make room for your next project. Find tools, parts, and everyday essentials to keep good spaces working beautifully.") }}</p>
        <a class="shop-primary" href="#shop-catalogue">{{ t("Explore the shop") }} <ArrowRight :size="18" /></a>
        <div class="shop-hero-foot"><span class="shop-star">✳</span><span>{{ t("A fresh start for your toolkit.") }}</span></div>
      </div>
      <div class="shop-hero-image">
        <img src="https://images.pexels.com/photos/11398216/pexels-photo-11398216.jpeg?auto=compress&cs=tinysrgb&w=1200" :alt="t('Drill and hand tools arranged on a wooden workbench')" fetchpriority="high" />
        <div class="shop-image-note"><span>{{ t("THE EVERYDAY ESSENTIALS") }}</span><strong>{{ t("Good tools.") }}<br />{{ t("Great beginnings.") }}</strong><ArrowUpRight :size="28" /></div>
      </div>
    </section>
    <div class="shop-values">
      <span><i class="mint" />{{ t("Tools for the task") }}</span>
      <span><i class="coral" />{{ t("Parts for the little fixes") }}</span>
      <span><i class="citron" />{{ t("Care for shared spaces") }}</span>
    </div>
    <section id="shop-catalogue" class="shop-catalogue" :aria-busy="shop.loading">
      <div class="shop-section-heading">
        <div><span class="shop-eyebrow">{{ t("BUILD YOUR TOOLKIT") }}</span><h2>{{ t("Find your next essential") }}</h2></div>
        <span v-if="ready" role="status">{{ t(products.length === 1 ? '{count} product' : '{count} products', { count: products.length }) }}</span>
      </div>
      <div class="shop-controls">
        <label class="shop-search"><Search :size="19" /><input v-model="query" type="search" :placeholder="t('Search tools, parts, and supplies')" :aria-label="t('Search products')" :disabled="!ready || checkoutBusy" /></label>
        <label class="shop-sort"><SlidersHorizontal :size="17" /><select v-model="sort" :aria-label="t('Sort products')" :disabled="!ready || checkoutBusy"><option value="name">{{ t("Name: A–Z") }}</option><option value="price-low">{{ t("Price: low to high") }}</option><option value="price-high">{{ t("Price: high to low") }}</option></select></label>
      </div>
      <div v-if="ready" class="shop-filters">
        <div class="shop-category-tabs" role="group" :aria-label="t('Product categories')">
          <button type="button" :aria-pressed="!category" @click="category = ''">{{ t("All products") }}</button>
          <button v-for="item in categories" :key="item" type="button" :aria-pressed="category === item" @click="category = item">{{ item }}</button>
        </div>
        <label><input v-model="availableOnly" type="checkbox" />{{ t("In stock only") }}</label>
      </div>
      <LoadingStatus v-if="shop.loading" :label="t('Loading the latest catalogue.')" />
      <div v-else-if="shop.error" class="shop-state">
        <span class="shop-state-icon"><ShoppingBag :size="29" /></span>
        <span class="shop-eyebrow">{{ t(catalogPath ? 'CATALOGUE UNAVAILABLE' : 'SOMETHING GOOD IS TAKING SHAPE') }}</span>
        <h3>{{ t(catalogPath ? 'We couldn’t load the shop.' : 'Your next project starts here. Soon.') }}</h3>
        <p role="status">{{ t(shop.error) }}</p>
        <button v-if="catalogPath" class="shop-secondary" type="button" @click="shop.refresh()"><RefreshCw :size="16" />{{ t("Try again") }}</button>
      </div>
      <div v-else-if="!products.length" class="shop-state">
        <Package :size="32" />
        <h3>{{ t(shop.catalog?.products.length ? 'No matches just yet.' : 'The shelves are getting ready.') }}</h3>
        <p>{{ t(shop.catalog?.products.length ? 'Try another search or give your filters a little room.' : 'There are no products in the catalogue yet. Check back for new additions.') }}</p>
        <button v-if="shop.catalog?.products.length" class="shop-secondary" type="button" @click="clearFilters">{{ t("Clear filters") }}</button>
        <button v-else class="shop-secondary" type="button" @click="shop.refresh()">{{ t("Refresh catalogue") }}</button>
      </div>
      <div v-else class="shop-product-grid">
        <article v-for="product in products" :key="product.id" class="shop-product-card">
          <button class="shop-product-open" type="button" :aria-label="t('View {name}', { name: product.name })" @click="inspect(product.id)">
            <ProductImage :src="product.imageUrl" :alt="product.name" />
          </button>
          <div class="shop-product-copy">
            <span class="shop-eyebrow">{{ product.category }}</span>
            <button class="shop-product-name" type="button" @click="inspect(product.id)">{{ product.name }}</button>
            <p v-if="product.brand">{{ product.brand }}</p>
            <div class="shop-product-bottom">
              <div><strong>{{ shop.money(product.priceMinor) }}</strong><small>{{ t(product.stock ? 'In stock' : 'Out of stock') }}</small></div>
              <button class="shop-add" type="button" :disabled="!product.stock || (shop.quantities[product.id] || 0) >= product.stock" :aria-label="t('Add {name} to basket', { name: product.name })" @click="add(product.id)"><Plus :size="20" /></button>
            </div>
          </div>
        </article>
      </div>
    </section>
    <section class="shop-editorial">
      <img src="https://images.pexels.com/photos/30413428/pexels-photo-30413428.jpeg?auto=compress&cs=tinysrgb&w=1000" :alt="t('A selection of cordless drills on a workshop bench')" loading="lazy" />
      <div>
        <span class="shop-eyebrow">{{ t("A LITTLE PREPARATION GOES A LONG WAY") }}</span>
        <h2>{{ t('Ready for the next little fix.') }}</h2>
        <p>{{ t("Start with the task. Check the fit, materials, and specifications before choosing what goes into your toolkit.") }}</p>
        <a href="#shop-catalogue">{{ t("Find your essentials") }} <ArrowUpRight :size="19" /></a>
      </div>
      <span class="shop-editorial-flower" aria-hidden="true">✳</span>
    </section>
    <p class="shop-photo-credit">{{ t("Workshop photography:") }} <a href="https://www.pexels.com/photo/close-up-shot-of-a-hand-drill-11398216/" target="_blank" rel="noopener noreferrer">Benjamin Lehman</a> &amp; <a href="https://www.pexels.com/photo/close-up-of-power-drills-on-a-workbench-30413428/" target="_blank" rel="noopener noreferrer">Christina &amp; Peter</a> / Pexels. {{ t('Editorial images.') }}</p>
    <span class="sr-only" role="status" aria-live="polite">{{ announcementText }}</span>

    <dialog ref="detail" class="shop-dialog" aria-labelledby="product-title">
      <div class="shop-dialog-top"><span class="shop-eyebrow">{{ t("A CLOSER LOOK") }}</span><button type="button" :aria-label="t('Close product details')" @click="detail?.close()"><X :size="22" /></button></div>
      <template v-if="selected">
        <ProductImage :src="selected.imageUrl" :alt="selected.name" />
        <span class="shop-eyebrow">{{ selected.category }}</span>
        <h2 id="product-title">{{ selected.name }}</h2>
        <p v-if="selected.brand">{{ selected.brand }}</p>
        <p class="shop-description">{{ selected.description }}</p>
        <strong class="shop-detail-price">{{ shop.money(selected.priceMinor) }}</strong>
        <p>{{ selected.stock ? t('{count} available', { count: selected.stock }) : t('Currently out of stock') }}</p>
        <button class="shop-primary" type="button" :disabled="!ready || !selected.stock || (shop.quantities[selected.id] || 0) >= selected.stock" @click="add(selected.id)">{{ t("Add to basket") }} <Plus :size="18" /></button>
        <p role="status">{{ announcementText }}</p>
      </template>
    </dialog>

    <dialog ref="basket" class="shop-dialog shop-cart-dialog" aria-labelledby="basket-title">
      <div class="shop-dialog-top"><h2 id="basket-title">{{ t("Your basket") }} <span>({{ shop.count }})</span></h2><button type="button" :aria-label="t('Close basket')" @click="basket?.close()"><X :size="22" /></button></div>
      <div v-if="!shop.lines.length" class="shop-state">
        <ShoppingBag :size="36" />
        <h3>{{ t("A little room for possibilities.") }}</h3>
        <p>{{ t("Your basket is empty. Explore the catalogue to get started.") }}</p>
        <button class="shop-primary" type="button" @click="basket?.close()">{{ t("Continue browsing") }} <ArrowRight :size="17" /></button>
      </div>
      <template v-else>
        <p class="shop-cart-note">{{ t("Your basket stays in this session until you check out. Stock is reserved only when an order is created.") }}</p>
        <p v-if="shop.error" role="alert">{{ t("Refresh the catalogue before changing your basket.") }}</p>
        <article v-for="line in shop.lines" :key="line.product.id" class="shop-cart-line">
          <ProductImage :src="line.product.imageUrl" :alt="line.product.name" />
          <div>
            <h3>{{ line.product.name }}</h3>
            <p>{{ t('{price} each', { price: shop.money(line.product.priceMinor) }) }}</p>
            <div class="shop-quantity">
              <button type="button" :disabled="!ready || checkoutBusy" :aria-label="t('Decrease {name} quantity', { name: line.product.name })" @click="shop.setQuantity(line.product.id, line.quantity - 1)"><Minus :size="14" /></button>
              <span :aria-label="t('Quantity: {count}', { count: line.quantity })">{{ line.quantity }}</span>
              <button type="button" :disabled="!ready || line.quantity >= line.product.stock" :aria-label="t('Increase {name} quantity', { name: line.product.name })" @click="shop.setQuantity(line.product.id, line.quantity + 1)"><Plus :size="14" /></button>
              <button class="shop-remove" type="button" :disabled="!ready || checkoutBusy" @click="shop.setQuantity(line.product.id, 0)">{{ t("Remove") }}</button>
            </div>
          </div>
          <strong>{{ shop.money(line.product.priceMinor * line.quantity) }}</strong>
        </article>
        <div class="shop-cart-total"><span>{{ t("Product subtotal") }}</span><strong>{{ shop.money(shop.subtotal) }}</strong></div>
        <template v-if="auth.isAuthenticated">
          <div v-if="quote" class="shop-cart-total"><span>{{ t("Shipping") }}</span><strong>{{ money(quote.shippingMinor, quote.currency, quote.minorUnitDigits) }}</strong></div>
          <div v-if="quote" class="shop-cart-total"><span>{{ t("Order total") }}</span><strong>{{ money(quote.totalMinor, quote.currency, quote.minorUnitDigits) }}</strong></div>
          <label class="shop-field">{{ t("Full name") }}<input v-model="shippingName" :disabled="checkoutBusy" maxlength="255" type="text" autocomplete="name" /></label>
          <label class="shop-field">{{ t("Phone (optional)") }}<input v-model="shippingPhone" :disabled="checkoutBusy" maxlength="64" type="tel" autocomplete="tel" /></label>
          <label class="shop-field">{{ t("Shipping address") }}<textarea v-model="shippingAddress" :disabled="checkoutBusy" maxlength="512" rows="3" autocomplete="street-address" /></label>
          <p v-if="checkoutError" role="alert">{{ t(checkoutError) }}</p>
          <button class="shop-primary" type="button" :disabled="checkoutBusy || !ready" @click="placeOrder">
            {{ t(checkoutBusy ? 'Placing order…' : 'Checkout') }}
          </button>
        </template>
        <template v-else>
          <p class="shop-cart-note">{{ t("Sign in to checkout and complete payment.") }}</p>
          <RouterLink class="shop-primary" to="/login">{{ t("Sign in to checkout") }}</RouterLink>
        </template>
        <button class="shop-secondary" type="button" :disabled="shop.loading" @click="shop.refresh()">{{ t("Refresh prices & availability") }}</button>
      </template>
    </dialog>

    <dialog ref="ordersDialog" class="shop-dialog shop-cart-dialog" aria-labelledby="orders-title">
      <div class="shop-dialog-top"><h2 id="orders-title">{{ t("Your orders") }}</h2><button type="button" :aria-label="t('Close orders')" @click="ordersDialog?.close()"><X :size="22" /></button></div>
      <LoadingStatus v-if="ordersLoading" :label="t('Loading orders…')" />
      <p v-if="ordersError" role="alert">{{ t(ordersError) }}</p>
      <div v-if="!ordersLoading && !ordersError && !orders.length" class="shop-state">
        <Package :size="32" />
        <h3>{{ t("No orders yet.") }}</h3>
        <p>{{ t("When you check out, your order history will appear here.") }}</p>
      </div>
      <article v-for="order in orders" :key="order.orderId" class="shop-cart-line shop-order-card">
        <div>
          <h3><RouterLink :to="{ name: 'shop-order', params: { orderId: order.orderId } }">{{ order.orderId }} · {{ t('View order details') }}</RouterLink></h3>
          <p>{{ t(order.fulfillmentStatus ? ({ ordered: 'Ordered', processing: 'Processing', shipped: 'Shipped', delivered: 'Delivered' } as const)[order.fulfillmentStatus] : order.status.replaceAll('_', ' ')) }} · {{ money(order.totalMinor, order.currency, order.minorUnitDigits) }}</p>
          <p>{{ order.items.map(i => `${i.quantity}× ${i.name}`).join(', ') }}</p>
          <RouterLink v-if="order.status === 'pending_payment'" class="shop-remove" :to="{ name: 'shop-order', params: { orderId: order.orderId } }">{{ t('Review cancellation') }}</RouterLink>
        </div>
      </article>
    </dialog>
  </div>
</template>
