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

it('gives visible feedback when adding a product', async () => {
  await render();
  await wrapper.get('.shop-add').trigger('click'); await flushPromises();
  expect(wrapper.get('.shop-feedback').text()).toContain('Tool added to your basket');
  expect(wrapper.get('.shop-feedback').classes()).not.toContain('sr-only');
  expect(useShopStore().count).toBe(1);
});
it('gives technicians visible feedback when they add a product to their basket', async () => {
  useAuthStore().user!.role = 'technician';
  await render();
  await wrapper.get('.shop-add').trigger('click'); await flushPromises();
  expect(wrapper.get('.shop-feedback').text()).toContain('Tool added to your basket');
  expect(useShopStore().count).toBe(1);
});
it('hides the in-stock filter for all-stock catalogues and shows stock counts', async () => {
  await render();
  expect(wrapper.text()).not.toContain('In stock only');
  expect(wrapper.get('.shop-product-bottom small').text()).toBe('3 available');
});
it('shows availability without an in-stock filter when catalogue availability is mixed', async () => {
  useShopStore().catalog!.products.push({ ...product, id: 'empty', name: 'Empty tool', stock: 0 });
  await render();
  expect(wrapper.text()).not.toContain('In stock only');
  expect(wrapper.findAll('.shop-product-bottom small').map(stock => stock.text())).toContain('Out of stock');
});
it('shows a simulation step and waits for an explicit payment action', async () => {
  await render(); useShopStore().setQuantity('tool', 1); await flushPromises();
  vi.mocked(api.createOrder).mockResolvedValue({ orderId: 'dev-fixture', totalMinor: 1000, paymentProvider: 'dev', checkoutUrl: 'http://localhost/dev' });
  const checkout = wrapper.findAll('.shop-primary').find(button => button.text() === 'Checkout')!;
  await checkout.trigger('click'); await flushPromises();
  expect(api.completeDevPayment).not.toHaveBeenCalled();
  const simulation = wrapper.get('dialog[aria-labelledby="simulation-title"]');
  expect(simulation.attributes('open')).toBeDefined();
  expect(simulation.text()).toContain('No money will be charged');
  vi.mocked(api.completeDevPayment).mockRejectedValue(new Error('Simulation unavailable'));
  await simulation.get('.shop-primary').trigger('click'); await flushPromises();
  expect(api.completeDevPayment).toHaveBeenCalledWith('dev-fixture');
  expect(simulation.get('[role="alert"]').text()).toBe('Simulation unavailable');
  expect(simulation.attributes('open')).toBeDefined();
});
it('shows the fulfillment stage in buyer order history', async () => {
  vi.mocked(api.listOrders).mockResolvedValue(['ordered','processing','shipped'].map((fulfillmentStatus, i) => ({orderId:`order-${i}`,status:'paid',fulfillmentStatus,currency:'USD',minorUnitDigits:2,totalMinor:1000,items:[]})) as unknown as import('../src/types/shop').ShopOrder[]);
  await render(); await wrapper.findAll('button').find(b => b.text() === 'Orders')!.trigger('click'); await flushPromises();
  const history=wrapper.get('#orders-title').element.closest('dialog')!; expect(history.textContent).toContain('Ordered'); expect(history.textContent).toContain('Processing'); expect(history.textContent).toContain('Shipped');
});

it('keeps checkout unavailable while a current total is pending', async () => {
  let finish!: (value: ShopQuote) => void;
  vi.mocked(api.quoteCheckout).mockReturnValue(new Promise(resolve => { finish = resolve; }));
  await render();
  useShopStore().setQuantity('tool', 1); await flushPromises();
  const checkout = wrapper.findAll('button').find(button => button.text() === 'Checkout')!;
  expect(checkout.attributes('disabled')).toBeDefined();
  expect(wrapper.text()).toContain('Calculating your order total…');
  checkout.element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await flushPromises();
  expect(api.createOrder).not.toHaveBeenCalled();
  finish(quote(1000)); await flushPromises();
  expect(checkout.attributes('disabled')).toBeUndefined();
});

it('requires retrying a failed total and preserves delivery data during recovery', async () => {
  vi.mocked(api.quoteCheckout).mockRejectedValueOnce(new Error('Quote service unavailable')).mockResolvedValueOnce(quote(1200));
  await render(); useShopStore().setQuantity('tool', 1); await flushPromises();
  await wrapper.get('input[autocomplete="name"]').setValue('Retained buyer');
  await wrapper.get('textarea[autocomplete="street-address"]').setValue('Retained delivery address');
  const checkout = wrapper.findAll('button').find(button => button.text() === 'Checkout')!;
  expect(checkout.attributes('disabled')).toBeDefined();
  checkout.element.dispatchEvent(new MouseEvent('click', { bubbles: true })); await flushPromises();
  expect(api.createOrder).not.toHaveBeenCalled();
  const retry = wrapper.findAll('button').find(button => button.text() === 'Retry order total')!;
  await retry.trigger('click'); await flushPromises();
  expect(checkout.attributes('disabled')).toBeUndefined();
  expect(wrapper.get('input[autocomplete="name"]').element.value).toBe('Retained buyer');
  expect(wrapper.get('textarea[autocomplete="street-address"]').element.value).toBe('Retained delivery address');
  expect(wrapper.findAll('.shop-cart-total').at(-1)!.text()).toContain('US$12.00');
});

it('keeps catalogue refresh near the basket heading and prevents it during checkout', async () => {
  await render(); useShopStore().setQuantity('tool', 1); await flushPromises();
  const basket = wrapper.get('dialog[aria-labelledby="basket-title"]');
  const refresh = basket.get('.basket-refresh');
  const children = [...basket.element.children];
  expect(children.indexOf(refresh.element)).toBeLessThan(children.indexOf(basket.get('.shop-cart-line').element));
  let finish!: (value: { orderId: string; totalMinor: number; paymentProvider: string; checkoutUrl: string }) => void;
  vi.mocked(api.createOrder).mockReturnValue(new Promise(resolve => { finish = resolve; }));
  await basket.findAll('button').find(button => button.text() === 'Checkout')!.trigger('click');
  expect(refresh.attributes('disabled')).toBeDefined();
  finish({ orderId: 'dev-fixture', totalMinor: 1000, paymentProvider: 'dev', checkoutUrl: 'http://localhost/dev' });
  await flushPromises();
  const simulation = wrapper.get('dialog[aria-labelledby="simulation-title"]');
  expect(simulation.findAll('button').find(button => button.text() === 'Leave unpaid')!.classes()).toContain('shop-secondary');
});
