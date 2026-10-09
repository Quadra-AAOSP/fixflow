<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  ArrowUpRight, ArrowRight, ShoppingBag, Search, Plus, Minus, X, Package,
  SlidersHorizontal, RefreshCw,
} from '@lucide/vue';
import { useShopStore } from '@/stores/shop';
import { useAuthStore } from '@/stores/auth';
import {
  cancelOrder,
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
const announcement = ref('');
const checkoutBusy = ref(false);
const checkoutError = ref('');
const shippingName = ref('');
const shippingPhone = ref('');
const shippingAddress = ref('');
const quote = ref<ShopQuote | null>(null);
const orders = ref<ShopOrder[]>([]);
const ordersError = ref('');
const ordersLoading = ref(false);

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
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount / 10 ** digits);
}

function add(id: string) {
  const before = shop.quantities[id] || 0;
  shop.setQuantity(id, before + 1);
  if (shop.quantities[id] > before) {
    announcement.value = `${shop.catalog?.products.find(p => p.id === id)?.name} added to your basket. ${shop.count} items in basket.`;
  }
}
function inspect(id: string) { detailId.value = id; detail.value?.showModal(); }
function clearFilters() { query.value = ''; category.value = ''; availableOnly.value = false; sort.value = 'name'; }

async function refreshQuote() {
  quote.value = null;
  checkoutError.value = '';
  if (!auth.isAuthenticated || !cartItems.value.length) return;
  try {
    quote.value = await quoteCheckout(cartItems.value);
  } catch (err) {
    checkoutError.value = errorMessage(err);
  }
}

async function placeOrder() {
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
    const result = await createOrder({
      items: cartItems.value,
      shippingName: shippingName.value.trim(),
      shippingPhone: shippingPhone.value.trim() || undefined,
      shippingAddress: shippingAddress.value.trim(),
      idempotencyKey: crypto.randomUUID(),
    });
    shop.clearBasket();
    quote.value = null;
    announcement.value = `Order ${result.orderId} created.`;
    if (result.checkoutUrl) {
      if (result.paymentProvider === 'dev') {
        await completeDevPayment(result.orderId);
        announcement.value = `Order ${result.orderId} paid (dev checkout).`;
        await loadOrders();
        basket.value?.close();
        ordersDialog.value?.showModal();
      } else {
        window.location.href = result.checkoutUrl;
      }
    }
  } catch (err) {
    checkoutError.value = errorMessage(err);
    await shop.refresh();
  } finally {
    checkoutBusy.value = false;
  }
}

async function loadOrders() {
  if (!auth.isAuthenticated) {
    orders.value = [];
    return;
  }
  ordersLoading.value = true;
  ordersError.value = '';
  try {
    orders.value = await listOrders();
  } catch (err) {
    ordersError.value = errorMessage(err);
  } finally {
    ordersLoading.value = false;
  }
}

async function cancelPending(orderId: string) {
  ordersError.value = '';
  try {
    await cancelOrder(orderId);
    await loadOrders();
    await shop.refresh();
  } catch (err) {
    ordersError.value = errorMessage(err);
  }
}

async function openOrders() {
  await loadOrders();
  ordersDialog.value?.showModal();
}

watch(cartItems, () => { void refreshQuote(); }, { deep: true });
watch(() => auth.isAuthenticated, (ok) => {
  if (ok) {
    shippingName.value = [auth.user?.firstName, auth.user?.lastName].filter(Boolean).join(' ');
    shippingPhone.value = auth.user?.phone ?? '';
    shippingAddress.value = auth.user?.address ?? '';
    void refreshQuote();
  } else {
    quote.value = null;
  }
}, { immediate: true });

onMounted(async () => {
  await auth.hydrate();
  if (!shop.catalog) await shop.refresh();
  const orderId = typeof route.query.orderId === 'string' ? route.query.orderId : '';
  const devPay = route.query.devPay === '1';
  if (orderId && auth.isAuthenticated) {
    if (devPay) {
      try { await completeDevPayment(orderId); } catch { /* already paid or unavailable */ }
    }
    await openOrders();
    router.replace({ path: '/shop', hash: '#shop-catalogue' });
  }
});
</script>

<template>
  <div class="fixflow-shop">
    <div class="shop-titlebar">
      <div>
        <span class="shop-eyebrow">THE FIXFLOW SHOP</span>
        <h1>A little care starts here.</h1>
      </div>
      <div class="shop-titlebar-actions">
        <button v-if="auth.isAuthenticated" class="shop-secondary" type="button" @click="openOrders">Orders</button>
        <button class="shop-basket-button" type="button" @click="basket?.showModal()">
          <ShoppingBag :size="19" />Your basket<span>{{ shop.count }}</span>
        </button>
      </div>
    </div>
    <section class="shop-hero">
      <div class="shop-hero-copy">
        <span class="shop-pill"><span /> FOR THE SPACES YOU CARE FOR</span>
        <h2>Small fixes.<br />Big <em>possibilities.</em></h2>
        <p>Make room for your next project. Find tools, parts, and everyday essentials to keep good spaces working beautifully.</p>
        <a class="shop-primary" href="#shop-catalogue">Explore the shop <ArrowRight :size="18" /></a>
        <div class="shop-hero-foot"><span class="shop-star">✳</span><span>A fresh start for your toolkit.</span></div>
      </div>
      <div class="shop-hero-image">
        <img src="https://images.pexels.com/photos/11398216/pexels-photo-11398216.jpeg?auto=compress&cs=tinysrgb&w=1200" alt="Drill and hand tools arranged on a wooden workbench" fetchpriority="high" />
        <div class="shop-image-note"><span>THE EVERYDAY ESSENTIALS</span><strong>Good tools.<br />Great beginnings.</strong><ArrowUpRight :size="28" /></div>
      </div>
    </section>
    <div class="shop-values">
      <span><i class="mint" />Tools for the task</span>
      <span><i class="coral" />Parts for the little fixes</span>
      <span><i class="citron" />Care for shared spaces</span>
    </div>
    <section id="shop-catalogue" class="shop-catalogue" :aria-busy="shop.loading">
      <div class="shop-section-heading">
        <div><span class="shop-eyebrow">BUILD YOUR TOOLKIT</span><h2>Find your next essential</h2></div>
        <span v-if="ready">{{ products.length }} {{ products.length === 1 ? 'product' : 'products' }}</span>
      </div>
      <div class="shop-controls">
        <label class="shop-search"><Search :size="19" /><input v-model="query" type="search" placeholder="Search tools, parts, and supplies" aria-label="Search products" :disabled="!ready" /></label>
        <label class="shop-sort"><SlidersHorizontal :size="17" /><select v-model="sort" aria-label="Sort products" :disabled="!ready"><option value="name">Name: A–Z</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select></label>
      </div>
      <div v-if="ready" class="shop-filters">
        <div class="shop-category-tabs" aria-label="Product categories">
          <button type="button" :aria-pressed="!category" @click="category = ''">All products</button>
          <button v-for="item in categories" :key="item" type="button" :aria-pressed="category === item" @click="category = item">{{ item }}</button>
        </div>
        <label><input v-model="availableOnly" type="checkbox" />In stock only</label>
      </div>
      <div v-if="shop.loading" class="shop-state" role="status"><RefreshCw :size="28" /><h3>Finding your essentials…</h3><p>Loading the latest catalogue.</p></div>
      <div v-else-if="shop.error" class="shop-state">
        <span class="shop-state-icon"><ShoppingBag :size="29" /></span>
        <span class="shop-eyebrow">{{ catalogPath ? 'CATALOGUE UNAVAILABLE' : 'SOMETHING GOOD IS TAKING SHAPE' }}</span>
        <h3>{{ catalogPath ? 'We couldn’t load the shop.' : 'Your next project starts here. Soon.' }}</h3>
        <p role="status">{{ shop.error }}</p>
        <button v-if="catalogPath" class="shop-secondary" type="button" @click="shop.refresh()"><RefreshCw :size="16" />Try again</button>
      </div>
      <div v-else-if="!products.length" class="shop-state">
        <Package :size="32" />
        <h3>{{ shop.catalog?.products.length ? 'No matches just yet.' : 'The shelves are getting ready.' }}</h3>
        <p>{{ shop.catalog?.products.length ? 'Try another search or give your filters a little room.' : 'There are no products in the catalogue yet. Check back for new additions.' }}</p>
        <button v-if="shop.catalog?.products.length" class="shop-secondary" type="button" @click="clearFilters">Clear filters</button>
        <button v-else class="shop-secondary" type="button" @click="shop.refresh()">Refresh catalogue</button>
      </div>
      <div v-else class="shop-product-grid">
        <article v-for="product in products" :key="product.id" class="shop-product-card">
          <button class="shop-product-open" type="button" :aria-label="`View ${product.name}`" @click="inspect(product.id)">
            <ProductImage :src="product.imageUrl" :alt="product.name" />
          </button>
          <div class="shop-product-copy">
            <span class="shop-eyebrow">{{ product.category }}</span>
            <button class="shop-product-name" type="button" @click="inspect(product.id)">{{ product.name }}</button>
            <p v-if="product.brand">{{ product.brand }}</p>
            <div class="shop-product-bottom">
              <div><strong>{{ shop.money(product.priceMinor) }}</strong><small>{{ product.stock ? 'In stock' : 'Out of stock' }}</small></div>
              <button class="shop-add" type="button" :disabled="!product.stock || (shop.quantities[product.id] || 0) >= product.stock" :aria-label="`Add ${product.name} to basket`" @click="add(product.id)"><Plus :size="20" /></button>
            </div>
          </div>
        </article>
      </div>
    </section>
    <section class="shop-editorial">
      <img src="https://images.pexels.com/photos/30413428/pexels-photo-30413428.jpeg?auto=compress&cs=tinysrgb&w=1000" alt="A selection of cordless drills on a workshop bench" loading="lazy" />
      <div>
        <span class="shop-eyebrow">A LITTLE PREPARATION GOES A LONG WAY</span>
        <h2>Ready for the<br />next little fix.</h2>
        <p>Start with the task. Check the fit, materials, and specifications before choosing what goes into your toolkit.</p>
        <a href="#shop-catalogue">Find your essentials <ArrowUpRight :size="19" /></a>
      </div>
      <span class="shop-editorial-flower" aria-hidden="true">✳</span>
    </section>
    <p class="shop-photo-credit">Workshop photography: <a href="https://www.pexels.com/photo/close-up-shot-of-a-hand-drill-11398216/" target="_blank" rel="noopener noreferrer">Benjamin Lehman</a> &amp; <a href="https://www.pexels.com/photo/close-up-of-power-drills-on-a-workbench-30413428/" target="_blank" rel="noopener noreferrer">Christina &amp; Peter</a> / Pexels. Editorial images.</p>
    <span class="sr-only" role="status" aria-live="polite">{{ announcement }}</span>

    <dialog ref="detail" class="shop-dialog" aria-labelledby="product-title">
      <div class="shop-dialog-top"><span class="shop-eyebrow">A CLOSER LOOK</span><button type="button" aria-label="Close product details" @click="detail?.close()"><X :size="22" /></button></div>
      <template v-if="selected">
        <ProductImage :src="selected.imageUrl" :alt="selected.name" />
        <span class="shop-eyebrow">{{ selected.category }}</span>
        <h2 id="product-title">{{ selected.name }}</h2>
        <p v-if="selected.brand">{{ selected.brand }}</p>
        <p class="shop-description">{{ selected.description }}</p>
        <strong class="shop-detail-price">{{ shop.money(selected.priceMinor) }}</strong>
        <p>{{ selected.stock ? `${selected.stock} available` : 'Currently out of stock' }}</p>
        <button class="shop-primary" type="button" :disabled="!ready || !selected.stock || (shop.quantities[selected.id] || 0) >= selected.stock" @click="add(selected.id)">Add to basket <Plus :size="18" /></button>
        <p role="status">{{ announcement }}</p>
      </template>
    </dialog>

    <dialog ref="basket" class="shop-dialog shop-cart-dialog" aria-labelledby="basket-title">
      <div class="shop-dialog-top"><h2 id="basket-title">Your basket <span>({{ shop.count }})</span></h2><button type="button" aria-label="Close basket" @click="basket?.close()"><X :size="22" /></button></div>
      <div v-if="!shop.lines.length" class="shop-state">
        <ShoppingBag :size="36" />
        <h3>A little room for possibilities.</h3>
        <p>Your basket is empty. Explore the catalogue to get started.</p>
        <button class="shop-primary" type="button" @click="basket?.close()">Continue browsing <ArrowRight :size="17" /></button>
      </div>
      <template v-else>
        <p class="shop-cart-note">Your basket stays in this session until you check out. Stock is reserved only when an order is created.</p>
        <p v-if="shop.error" role="alert">Refresh the catalogue before changing your basket.</p>
        <article v-for="line in shop.lines" :key="line.product.id" class="shop-cart-line">
          <ProductImage :src="line.product.imageUrl" :alt="line.product.name" />
          <div>
            <h3>{{ line.product.name }}</h3>
            <p>{{ shop.money(line.product.priceMinor) }} each</p>
            <div class="shop-quantity">
              <button type="button" :disabled="!ready" :aria-label="`Decrease ${line.product.name} quantity`" @click="shop.setQuantity(line.product.id, line.quantity - 1)"><Minus :size="14" /></button>
              <span :aria-label="`Quantity: ${line.quantity}`">{{ line.quantity }}</span>
              <button type="button" :disabled="!ready || line.quantity >= line.product.stock" :aria-label="`Increase ${line.product.name} quantity`" @click="shop.setQuantity(line.product.id, line.quantity + 1)"><Plus :size="14" /></button>
              <button class="shop-remove" type="button" :disabled="!ready" @click="shop.setQuantity(line.product.id, 0)">Remove</button>
            </div>
          </div>
          <strong>{{ shop.money(line.product.priceMinor * line.quantity) }}</strong>
        </article>
        <div class="shop-cart-total"><span>Product subtotal</span><strong>{{ shop.money(shop.subtotal) }}</strong></div>
        <template v-if="auth.isAuthenticated">
          <div v-if="quote" class="shop-cart-total"><span>Shipping</span><strong>{{ money(quote.shippingMinor, quote.currency, quote.minorUnitDigits) }}</strong></div>
          <div v-if="quote" class="shop-cart-total"><span>Order total</span><strong>{{ money(quote.totalMinor, quote.currency, quote.minorUnitDigits) }}</strong></div>
          <label class="shop-field">Full name<input v-model="shippingName" type="text" autocomplete="name" /></label>
          <label class="shop-field">Phone (optional)<input v-model="shippingPhone" type="tel" autocomplete="tel" /></label>
          <label class="shop-field">Shipping address<textarea v-model="shippingAddress" rows="3" autocomplete="street-address" /></label>
          <p v-if="checkoutError" role="alert">{{ checkoutError }}</p>
          <button class="shop-primary" type="button" :disabled="checkoutBusy || !ready" @click="placeOrder">
            {{ checkoutBusy ? 'Placing order…' : 'Checkout' }}
          </button>
        </template>
        <template v-else>
          <p class="shop-cart-note">Sign in to checkout and complete payment.</p>
          <RouterLink class="shop-primary" to="/login">Sign in to checkout</RouterLink>
        </template>
        <button class="shop-secondary" type="button" :disabled="shop.loading" @click="shop.refresh()">Refresh prices &amp; availability</button>
      </template>
    </dialog>

    <dialog ref="ordersDialog" class="shop-dialog shop-cart-dialog" aria-labelledby="orders-title">
      <div class="shop-dialog-top"><h2 id="orders-title">Your orders</h2><button type="button" aria-label="Close orders" @click="ordersDialog?.close()"><X :size="22" /></button></div>
      <p v-if="ordersLoading" role="status">Loading orders…</p>
      <p v-if="ordersError" role="alert">{{ ordersError }}</p>
      <div v-if="!ordersLoading && !orders.length" class="shop-state">
        <Package :size="32" />
        <h3>No orders yet.</h3>
        <p>When you check out, your order history will appear here.</p>
      </div>
      <article v-for="order in orders" :key="order.orderId" class="shop-cart-line shop-order-card">
        <div>
          <h3>{{ order.orderId }}</h3>
          <p>{{ order.status.replaceAll('_', ' ') }} · {{ money(order.totalMinor, order.currency, order.minorUnitDigits) }}</p>
          <p>{{ order.items.map(i => `${i.quantity}× ${i.name}`).join(', ') }}</p>
          <button
            v-if="order.status === 'pending_payment'"
            class="shop-remove"
            type="button"
            @click="cancelPending(order.orderId)"
          >Cancel order</button>
        </div>
      </article>
    </dialog>
  </div>
</template>
