// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import ShopOrderView from '../src/views/app/ShopOrderView.vue';
import { useAuthStore } from '../src/stores/auth';
import * as api from '../src/services/shop';
import type { ShopOrder } from '../src/types/shop';
import { setLocale } from '../src/i18n';
vi.mock('../src/services/shop', () => ({ getOrder: vi.fn(), cancelOrder: vi.fn(), confirmDelivery: vi.fn() }));
const order: ShopOrder = { orderId: 'order-a', status: 'pending_payment', currency: 'USD', minorUnitDigits: 2,
  items: [{ productId: 'tool', name: 'Tool', unitPriceMinor: 1234, quantity: 1, lineTotalMinor: 1234 }], subtotalMinor: 1234, shippingMinor: 100, taxMinor: 50, totalMinor: 1384,
  fulfillmentStatus: null, processingAt: null, shippedAt: null, deliveryConfirmedAt: null, deliverySignedName: null, canConfirmDelivery: false,
  shippingName: 'Fixture Buyer', shippingPhone: null, shippingAddress: 'Fixture delivery address', checkoutUrl: null, paymentStatus: 'requires_action', createdAt: '2026-11-02T01:00:00Z', updatedAt: '2026-11-02T01:00:00Z' };
beforeEach(() => {
  setActivePinia(createPinia()); vi.resetAllMocks(); setLocale('en');
  useAuthStore().user = { id: 1, role: 'reporter', siteId: 7, firstName: 'Test', lastName: 'Buyer', email: 'buyer@example.invalid', phone: null, address: null };
  vi.mocked(api.getOrder).mockResolvedValue(order);
});
async function render() {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/shop/orders/:orderId', component: { template: '<div />' } }, { path: '/shop', component: { template: '<div />' } }] });
  await router.push('/shop/orders/order-a'); const wrapper = mount(ShopOrderView, { global: { plugins: [router] } }); await flushPromises(); return { wrapper, router };
}
it('shows authoritative line totals, delivery and returned currency precision', async () => {
  const { wrapper } = await render(); expect(api.getOrder).toHaveBeenCalledWith('order-a');
  expect(wrapper.text()).toContain('Fixture delivery address'); expect(wrapper.text()).toContain('US$13.84'); expect(wrapper.text()).toContain('Tax'); wrapper.unmount();
});
it('requires cancellation confirmation and preserves the order after server rejection', async () => {
  const { wrapper } = await render(); await wrapper.findAll('button').find(b => b.text() === 'Cancel order')!.trigger('click');
  expect(api.cancelOrder).not.toHaveBeenCalled(); vi.mocked(api.cancelOrder).mockRejectedValue(new Error('Payment state changed'));
  await wrapper.findAll('button').find(b => b.text() === 'Confirm order cancellation')!.trigger('click'); await flushPromises();
  expect(wrapper.get('[role="alert"]').text()).toBe('Payment state changed'); expect(wrapper.text()).toContain('Fixture delivery address'); wrapper.unmount();
});
it('clears shipping data and ignores old responses when navigating to an inaccessible order', async () => {
  let finish!: (value: ShopOrder) => void;
  vi.mocked(api.getOrder).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const { wrapper, router } = await render();
  vi.mocked(api.getOrder).mockRejectedValue(new Error('Order not found'));
  await router.push('/shop/orders/order-b'); await flushPromises(); finish(order); await flushPromises();
  expect(wrapper.text()).toContain('Order not found'); expect(wrapper.text()).not.toContain('Fixture delivery address'); wrapper.unmount();
});
it('clears order data on logout', async () => {
  const { wrapper } = await render(); useAuthStore().user = null; await flushPromises();
  expect(wrapper.text()).not.toContain('Fixture delivery address'); expect(wrapper.find('dl').exists()).toBe(false); wrapper.unmount();
});

it('requires a signed name and acknowledgement to confirm shipped delivery', async () => {
  vi.mocked(api.getOrder).mockResolvedValue({...order, status:'paid', fulfillmentStatus:'shipped', canConfirmDelivery:true});
  vi.mocked(api.confirmDelivery).mockResolvedValue({...order, status:'paid', fulfillmentStatus:'delivered', canConfirmDelivery:false, deliverySignedName:'Buyer', deliveryConfirmedAt:'2026-11-08T00:00:00Z'});
  const { wrapper } = await render(); const button=wrapper.findAll('button').find(b=>b.text()==='Confirm delivery')!; expect(button.attributes('disabled')).toBeDefined();
  await wrapper.get('input:not([type=checkbox])').setValue('Buyer'); await wrapper.get('input[type=checkbox]').setValue(true); await wrapper.get('form').trigger('submit'); await flushPromises();
  expect(api.confirmDelivery).toHaveBeenCalledWith('order-a','Buyer'); expect(wrapper.text()).toContain('Received by Buyer'); wrapper.unmount();
});
it('clears receipt inputs when changing orders', async () => {
  vi.mocked(api.getOrder).mockImplementation(async id => ({...order,orderId:id,status:'paid',fulfillmentStatus:'shipped',canConfirmDelivery:true}));
  const {wrapper,router}=await render(); await wrapper.get('input:not([type=checkbox])').setValue('Buyer'); await wrapper.get('input[type=checkbox]').setValue(true);
  await router.push('/shop/orders/order-b'); await flushPromises(); expect((wrapper.get('input:not([type=checkbox])').element as HTMLInputElement).value).toBe(''); expect((wrapper.get('input[type=checkbox]').element as HTMLInputElement).checked).toBe(false); wrapper.unmount();
});

it('rejects a receipt name longer than 160 characters', async () => {
  vi.mocked(api.getOrder).mockResolvedValue({...order,status:'paid',fulfillmentStatus:'shipped',canConfirmDelivery:true});
  const {wrapper}=await render(); const input=wrapper.get('input:not([type=checkbox])'); expect(input.attributes('maxlength')).toBe('160');
  await input.setValue('A'.repeat(161)); await wrapper.get('input[type=checkbox]').setValue(true);
  expect(wrapper.findAll('button').find(b=>b.text()==='Confirm delivery')!.attributes('disabled')).toBeDefined();
  await wrapper.get('form').trigger('submit'); expect(api.confirmDelivery).not.toHaveBeenCalled(); wrapper.unmount();
});
