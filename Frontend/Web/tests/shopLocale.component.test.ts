// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import ShopView from '../src/views/app/ShopView.vue';
import { useShopStore } from '../src/stores/shop';
import { useAuthStore } from '../src/stores/auth';
import { setLocale } from '../src/i18n';
import * as api from '../src/services/shop';
vi.mock('../src/services/shop', async original => ({ ...await original<typeof api>(), quoteCheckout: vi.fn(), listOrders: vi.fn(), createOrder: vi.fn(), completeDevPayment: vi.fn() }));
const product = { id: 'actual-1', name: 'Original Tool', category: 'Tools', description: 'Original product description', brand: 'Original Brand', priceMinor: 1255, stock: 3, imageUrl: null };
let wrapper: VueWrapper;
beforeEach(() => {
  setActivePinia(createPinia()); vi.resetAllMocks(); setLocale('en');
  vi.spyOn(useAuthStore(), 'hydrate').mockResolvedValue();
  useShopStore().catalog = { currency: 'USD', minorUnitDigits: 2, products: [product] };
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value(this: HTMLDialogElement) { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute('open'); } });
});
afterEach(() => { wrapper?.unmount(); setLocale('en'); vi.restoreAllMocks(); });
async function render() {
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/shop', component: { template: '<div />' } }, { path: '/login', component: { template: '<div />' } },
  ] });
  await router.push('/shop'); wrapper = mount(ShopView, { global: { plugins: [router] } }); await flushPromises();
}
it('translates controls and prices while preserving actual product data and search input', async () => {
  await render(); await wrapper.get('.shop-search input').setValue('Original');
  setLocale('zh-CN'); await nextTick();
  expect(wrapper.get('h1').text()).toBe('商店');
  expect(wrapper.get('.shop-search input').attributes('aria-label')).toBe('搜索商品');
  expect(wrapper.get<HTMLInputElement>('.shop-search input').element.value).toBe('Original');
  expect(wrapper.text()).toContain('Original Tool'); expect(wrapper.text()).toContain('Original Brand');
  const expected = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(12.55);
  expect(wrapper.get('.shop-product-bottom strong').text()).toBe(expected);
  await wrapper.get('.shop-product-open').trigger('click');
  expect(wrapper.get('#product-title').text()).toBe('Original Tool');
  expect(wrapper.get('.shop-description').text()).toBe('Original product description');
  expect(wrapper.get('dialog p[role="status"]').text()).toBe('');
  expect(api.createOrder).not.toHaveBeenCalled(); expect(api.completeDevPayment).not.toHaveBeenCalled();
});
it('uses Chinese image fallbacks and basket announcements without translating product names', async () => {
  setLocale('zh-CN'); await render();
  expect(wrapper.get('[role="img"]').attributes('aria-label')).toBe('Original Tool 暂无可用图片');
  await wrapper.get('.shop-add').trigger('click');
  expect(useShopStore().quantities).toEqual({ 'actual-1': 1 });
  expect(wrapper.get('[aria-live="polite"]').text()).toContain('Original Tool 已加入购物篮');
  setLocale('en'); await nextTick();
  expect(wrapper.get('[aria-live="polite"]').text()).toContain('Original Tool added to your basket.');
  expect(api.quoteCheckout).not.toHaveBeenCalled(); expect(api.createOrder).not.toHaveBeenCalled();
});
