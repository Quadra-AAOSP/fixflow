<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ArrowUpRight, ArrowRight, ShoppingBag, Search, Plus, Minus, X, Package, SlidersHorizontal, RefreshCw } from '@lucide/vue';
import { useShopStore } from '@/stores/shop';
import { catalogPath } from '@/services/shop';
import ProductImage from '@/components/shop/ProductImage.vue';
import '@/styles/shop.css';

const shop = useShopStore();
const query = ref('');
const category = ref('');
const sort = ref('name');
const availableOnly = ref(false);
const detailId = ref<string | null>(null);
const detail = ref<HTMLDialogElement>();
const basket = ref<HTMLDialogElement>();
const announcement = ref('');
const categories = computed(() => [...new Set(shop.catalog?.products.map(p => p.category) ?? [])].sort());
const selected = computed(() => shop.catalog?.products.find(p => p.id === detailId.value));
const products = computed(() => (shop.catalog?.products ?? []).filter(p => {
  return (!category.value || p.category === category.value) && (!availableOnly.value || p.stock > 0)
    && `${p.name} ${p.brand ?? ''} ${p.description} ${p.category}`.toLowerCase().includes(query.value.trim().toLowerCase());
}).sort((a, b) => sort.value === 'price-low' ? a.priceMinor - b.priceMinor : sort.value === 'price-high' ? b.priceMinor - a.priceMinor : a.name.localeCompare(b.name)));
const ready = computed(() => !!shop.catalog && !shop.error && !shop.loading);
function add(id: string) {
  const before = shop.quantities[id] || 0;
  shop.setQuantity(id, before + 1);
  if (shop.quantities[id] > before) announcement.value = `${shop.catalog?.products.find(p => p.id === id)?.name} added to your basket. ${shop.count} items in basket.`;
}
function inspect(id: string) { detailId.value = id; detail.value?.showModal(); }
function clearFilters() { query.value = ''; category.value = ''; availableOnly.value = false; sort.value = 'name'; }
onMounted(() => { if (!shop.catalog) void shop.refresh(); });
</script>

<template>
  <div class="fixflow-shop">
    <div class="shop-titlebar"><div><span class="shop-eyebrow">THE FIXFLOW SHOP</span><h1>A little care starts here.</h1></div><button class="shop-basket-button" @click="basket?.showModal()"><ShoppingBag :size="19" />Your basket<span>{{ shop.count }}</span></button></div>
    <section class="shop-hero">
      <div class="shop-hero-copy"><span class="shop-pill"><span /> FOR THE SPACES YOU CARE FOR</span><h2>Small fixes.<br />Big <em>possibilities.</em></h2><p>Make room for your next project. Find tools, parts, and everyday essentials to keep good spaces working beautifully.</p><a class="shop-primary" href="#shop-catalogue">Explore the shop <ArrowRight :size="18" /></a><div class="shop-hero-foot"><span class="shop-star">✳</span><span>A fresh start for your toolkit.</span></div></div>
      <div class="shop-hero-image"><img src="https://images.pexels.com/photos/11398216/pexels-photo-11398216.jpeg?auto=compress&cs=tinysrgb&w=1200" alt="Drill and hand tools arranged on a wooden workbench" fetchpriority="high" /><div class="shop-image-note"><span>THE EVERYDAY ESSENTIALS</span><strong>Good tools.<br />Great beginnings.</strong><ArrowUpRight :size="28" /></div></div>
    </section>
    <div class="shop-values"><span><i class="mint" />Tools for the task</span><span><i class="coral" />Parts for the little fixes</span><span><i class="citron" />Care for shared spaces</span></div>
    <section id="shop-catalogue" class="shop-catalogue" :aria-busy="shop.loading">
      <div class="shop-section-heading"><div><span class="shop-eyebrow">BUILD YOUR TOOLKIT</span><h2>Find your next essential</h2></div><span v-if="ready">{{ products.length }} {{ products.length === 1 ? 'product' : 'products' }}</span></div>
      <div class="shop-controls"><label class="shop-search"><Search :size="19" /><input v-model="query" type="search" placeholder="Search tools, parts, and supplies" aria-label="Search products" :disabled="!ready" /></label><label class="shop-sort"><SlidersHorizontal :size="17" /><select v-model="sort" aria-label="Sort products" :disabled="!ready"><option value="name">Name: A–Z</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select></label></div>
      <div v-if="ready" class="shop-filters"><div class="shop-category-tabs" aria-label="Product categories"><button :aria-pressed="!category" @click="category = ''">All products</button><button v-for="item in categories" :key="item" :aria-pressed="category === item" @click="category = item">{{ item }}</button></div><label><input v-model="availableOnly" type="checkbox" />In stock only</label></div>
      <div v-if="shop.loading" class="shop-state" role="status"><RefreshCw :size="28" /><h3>Finding your essentials…</h3><p>Loading the latest catalogue.</p></div>
      <div v-else-if="shop.error" class="shop-state"><span class="shop-state-icon"><ShoppingBag :size="29" /></span><span class="shop-eyebrow">{{ catalogPath ? 'CATALOGUE UNAVAILABLE' : 'SOMETHING GOOD IS TAKING SHAPE' }}</span><h3>{{ catalogPath ? 'We couldn’t load the shop.' : 'Your next project starts here. Soon.' }}</h3><p role="status">{{ shop.error }}</p><button v-if="catalogPath" class="shop-secondary" @click="shop.refresh()"><RefreshCw :size="16" />Try again</button></div>
      <div v-else-if="!products.length" class="shop-state"><Package :size="32" /><h3>{{ shop.catalog?.products.length ? 'No matches just yet.' : 'The shelves are getting ready.' }}</h3><p>{{ shop.catalog?.products.length ? 'Try another search or give your filters a little room.' : 'There are no products in the catalogue yet. Check back for new additions.' }}</p><button v-if="shop.catalog?.products.length" class="shop-secondary" @click="clearFilters">Clear filters</button><button v-else class="shop-secondary" @click="shop.refresh()">Refresh catalogue</button></div>
      <div v-else class="shop-product-grid"><article v-for="product in products" :key="product.id" class="shop-product-card"><button class="shop-product-open" :aria-label="`View ${product.name}`" @click="inspect(product.id)"><ProductImage :src="product.imageUrl" :alt="product.name" /></button><div class="shop-product-copy"><span class="shop-eyebrow">{{ product.category }}</span><button class="shop-product-name" @click="inspect(product.id)">{{ product.name }}</button><p v-if="product.brand">{{ product.brand }}</p><div class="shop-product-bottom"><div><strong>{{ shop.money(product.priceMinor) }}</strong><small>{{ product.stock ? 'In stock' : 'Out of stock' }}</small></div><button class="shop-add" :disabled="!product.stock || (shop.quantities[product.id] || 0) >= product.stock" :aria-label="`Add ${product.name} to basket`" @click="add(product.id)"><Plus :size="20" /></button></div></div></article></div>
    </section>
    <section class="shop-editorial"><img src="https://images.pexels.com/photos/30413428/pexels-photo-30413428.jpeg?auto=compress&cs=tinysrgb&w=1000" alt="A selection of cordless drills on a workshop bench" loading="lazy" /><div><span class="shop-eyebrow">A LITTLE PREPARATION GOES A LONG WAY</span><h2>Ready for the<br />next little fix.</h2><p>Start with the task. Check the fit, materials, and specifications before choosing what goes into your toolkit.</p><a href="#shop-catalogue">Find your essentials <ArrowUpRight :size="19" /></a></div><span class="shop-editorial-flower" aria-hidden="true">✳</span></section>
    <p class="shop-photo-credit">Workshop photography: <a href="https://www.pexels.com/photo/close-up-shot-of-a-hand-drill-11398216/" target="_blank" rel="noopener noreferrer">Benjamin Lehman</a> &amp; <a href="https://www.pexels.com/photo/close-up-of-power-drills-on-a-workbench-30413428/" target="_blank" rel="noopener noreferrer">Christina &amp; Peter</a> / Pexels. Editorial images.</p>
    <span class="sr-only" role="status" aria-live="polite">{{ announcement }}</span>
    <dialog ref="detail" class="shop-dialog" aria-labelledby="product-title"><div class="shop-dialog-top"><span class="shop-eyebrow">A CLOSER LOOK</span><button aria-label="Close product details" @click="detail?.close()"><X :size="22" /></button></div><template v-if="selected"><ProductImage :src="selected.imageUrl" :alt="selected.name" /><span class="shop-eyebrow">{{ selected.category }}</span><h2 id="product-title">{{ selected.name }}</h2><p v-if="selected.brand">{{ selected.brand }}</p><p class="shop-description">{{ selected.description }}</p><strong class="shop-detail-price">{{ shop.money(selected.priceMinor) }}</strong><p>{{ selected.stock ? `${selected.stock} available` : 'Currently out of stock' }}</p><button class="shop-primary" :disabled="!ready || !selected.stock || (shop.quantities[selected.id] || 0) >= selected.stock" @click="add(selected.id)">Add to basket <Plus :size="18" /></button><p role="status">{{ announcement }}</p></template></dialog>
    <dialog ref="basket" class="shop-dialog shop-cart-dialog" aria-labelledby="basket-title"><div class="shop-dialog-top"><h2 id="basket-title">Your basket <span>({{ shop.count }})</span></h2><button aria-label="Close basket" @click="basket?.close()"><X :size="22" /></button></div><div v-if="!shop.lines.length" class="shop-state"><ShoppingBag :size="36" /><h3>A little room for possibilities.</h3><p>Your basket is empty. Explore the catalogue to get started.</p><button class="shop-primary" @click="basket?.close()">Continue browsing <ArrowRight :size="17" /></button></div><template v-else><p class="shop-cart-note">Your basket stays in this session. Items are not reserved.</p><p v-if="shop.error" role="alert">Refresh the catalogue before changing your basket.</p><article v-for="line in shop.lines" :key="line.product.id" class="shop-cart-line"><ProductImage :src="line.product.imageUrl" :alt="line.product.name" /><div><h3>{{ line.product.name }}</h3><p>{{ shop.money(line.product.priceMinor) }} each</p><div class="shop-quantity"><button :disabled="!ready" :aria-label="`Decrease ${line.product.name} quantity`" @click="shop.setQuantity(line.product.id, line.quantity - 1)"><Minus :size="14" /></button><span :aria-label="`Quantity: ${line.quantity}`">{{ line.quantity }}</span><button :disabled="!ready || line.quantity >= line.product.stock" :aria-label="`Increase ${line.product.name} quantity`" @click="shop.setQuantity(line.product.id, line.quantity + 1)"><Plus :size="14" /></button><button class="shop-remove" :disabled="!ready" @click="shop.setQuantity(line.product.id, 0)">Remove</button></div></div><strong>{{ shop.money(line.product.priceMinor * line.quantity) }}</strong></article><div class="shop-cart-total"><span>Product subtotal</span><strong>{{ shop.money(shop.subtotal) }}</strong></div><p class="shop-cart-note">Delivery and taxes have not been calculated.</p><button class="shop-primary" disabled>Checkout is not available yet</button><p class="shop-cart-note">Ordering and payments have not opened. No order will be placed and you will not be charged.</p><button class="shop-secondary" :disabled="shop.loading" @click="shop.refresh()">Refresh prices &amp; availability</button></template></dialog>
  </div>
</template>
