// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import ShopView from '../src/views/app/ShopView.vue';
import { useShopStore } from '../src/stores/shop';
import { useAuthStore } from '../src/stores/auth';
import { setLocale } from '../src/i18n';
import * as api from '../src/services/shop';
import { stubApiFetch } from './csrfFetch';
import type { ShopQuote } from '../src/types/shop';
vi.mock('../src/services/shop', async original => ({ ...await original<typeof api>(), quoteCheckout: vi.fn(), listOrders: vi.fn(), createOrder: vi.fn(), completeDevPayment: vi.fn() }));
let wrapper: VueWrapper;
const product = { id: 'tool', name: 'Tool', category: 'Tools', description: 'Test tool', brand: null, imageUrl: null, priceMinor: 1000, stock: 3 };
const quote = (total: number): ShopQuote => ({ currency: 'USD', minorUnitDigits: 2, lines: [], subtotalMinor: total, shippingMinor: 0, taxMinor: 0, totalMinor: total });
beforeEach(() => {
  setActivePinia(createPinia()); vi.resetAllMocks(); setLocale('en');
  const auth = useAuthStore(); auth.user = { id: 1, role: 'reporter', siteId: 7, firstName: 'Fixture', lastName: 'Buyer', email: 'buyer@example.invalid', phone: null, address: 'Fixture address' };
  vi.spyOn(auth, 'hydrate').mockResolvedValue();
  const shop = useShopStore(); shop.catalog = { currency: 'USD', minorUnitDigits: 2, products: [product] };
  vi.spyOn(shop, 'refresh').mockResolvedValue();
  vi.mocked(api.quoteCheckout).mockResolvedValue(quote(1000));
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value(this: HTMLDialogElement) { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute('open'); } });
});
afterEach(() => { wrapper?.unmount(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
async function render(query = '') {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/shop', component: { template: '<div />' } }, { path: '/shop/orders/:orderId', name: 'shop-order', component: { template: '<div />' } }] });
  await router.push('/shop' + query); wrapper = mount(ShopView, { global: { plugins: [router] } }); await flushPromises(); return router;
}
it('ignores an old quote when a newer basket request has completed', async () => {
  let finish!: (value: ShopQuote) => void;
  vi.mocked(api.quoteCheckout).mockReturnValueOnce(new Promise(resolve => { finish = resolve; })).mockResolvedValueOnce(quote(2000));
  await render(); useShopStore().setQuantity('tool', 1); await flushPromises();
  useShopStore().setQuantity('tool', 2); await flushPromises(); finish(quote(9999)); await flushPromises();
  expect(wrapper.findAll('.shop-cart-total').at(-1)!.text()).toContain('US$20.00');
  expect(wrapper.findAll('.shop-cart-total').at(-1)!.text()).not.toContain('99.99');
});
it('retains the idempotency key when retrying unchanged checkout after a network failure', async () => {
  await render(); useShopStore().setQuantity('tool', 1); await flushPromises();
  vi.mocked(api.createOrder).mockRejectedValue(new Error('Network interrupted'));
  const checkout = wrapper.findAll('.shop-primary').find(b => b.text() === 'Checkout')!;
  await checkout.trigger('click'); await flushPromises(); await checkout.trigger('click'); await flushPromises();
  expect(api.createOrder).toHaveBeenCalledTimes(2);
  expect(vi.mocked(api.createOrder).mock.calls[0]![0].idempotencyKey).toBe(vi.mocked(api.createOrder).mock.calls[1]![0].idempotencyKey);
});
it('does not let a return URL trigger a development payment', async () => {
  const router = await render('?orderId=order-a&devPay=1');
  expect(api.completeDevPayment).not.toHaveBeenCalled(); expect(api.createOrder).not.toHaveBeenCalled();
  expect(router.currentRoute.value.name).toBe('shop-order');
});

it('keeps the basket and retry key when the real service rejects an invalid payment response', async () => {
  const actual = await vi.importActual<typeof api>('../src/services/shop');
  vi.mocked(api.createOrder).mockImplementation(actual.createOrder);
  const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({
    orderId: 'created-fixture', totalMinor: 1000, paymentProvider: 'provider', checkoutUrl: 'javascript:alert(1)',
  }))));
  stubApiFetch(fetch);
  await render(); useShopStore().setQuantity('tool', 1); await flushPromises();
  const checkout = wrapper.findAll('.shop-primary').find(b => b.text() === 'Checkout')!;
  await checkout.trigger('click'); await flushPromises();
  expect(wrapper.text()).toContain('Open Orders to check the order status');
  expect(useShopStore().count).toBe(1);
  await checkout.trigger('click'); await flushPromises();
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch.mock.calls[0]![1].headers.get('Idempotency-Key')).toBe(fetch.mock.calls[1]![1].headers.get('Idempotency-Key'));
});
