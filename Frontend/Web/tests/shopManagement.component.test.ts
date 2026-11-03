// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { flushPromises, mount } from '@vue/test-utils';
import ShopManagementView from '../src/views/app/ShopManagementView.vue';
import { useAuthStore } from '../src/stores/auth';
import * as api from '../src/services/shopAdmin';
import { setLocale } from '../src/i18n';
vi.mock('../src/services/shopAdmin', () => ({ listManagedProducts: vi.fn(), getManagedProduct: vi.fn(), saveManagedProduct: vi.fn(), deactivateManagedProduct: vi.fn() }));
const product: api.ManagedProduct = { id: 'drill', name: 'Drill', description: 'Cordless drill', category: 'Tools', brand: null, imageUrl: null, priceMinor: 12500, stock: 9, active: true, createdAt: '2026-01-01', updatedAt: '2026-01-01' };
beforeEach(() => {
  setActivePinia(createPinia()); vi.resetAllMocks(); setLocale('en');
  useAuthStore().user = { id: 4, role: 'shop_manager', siteId: null, firstName: 'Shop', lastName: 'Manager', email: 'shop@example.invalid', phone: null, address: null };
  vi.mocked(api.listManagedProducts).mockResolvedValue([product]);
  vi.mocked(api.getManagedProduct).mockResolvedValue(product);
});
it('loads real product detail for editing and applies only the saved response', async () => {
  const wrapper = mount(ShopManagementView); await flushPromises();
  await wrapper.get('article button').trigger('click'); await flushPromises();
  expect(api.getManagedProduct).toHaveBeenCalledWith('drill');
  const form = wrapper.get('form'); expect(form.get('input').attributes('readonly')).toBeDefined();
  await form.findAll('input')[1]!.setValue('Requested title');
  vi.mocked(api.saveManagedProduct).mockResolvedValue({ ...product, name: 'Server saved title' });
  await form.trigger('submit'); await flushPromises();
  expect(wrapper.get('article h2').text()).toBe('Server saved title'); wrapper.unmount();
});
it('requires a separate confirmation for deactivation and preserves the card on failure', async () => {
  const wrapper = mount(ShopManagementView); await flushPromises();
  await wrapper.findAll('article button')[1]!.trigger('click');
  expect(api.deactivateManagedProduct).not.toHaveBeenCalled();
  vi.mocked(api.deactivateManagedProduct).mockRejectedValue(new Error('Server refused'));
  await wrapper.get('.product-confirm button').trigger('click'); await flushPromises();
  expect(wrapper.get('[role="alert"]').text()).toContain('Server refused');
  expect(wrapper.get('article').text()).toContain('Active');
  vi.mocked(api.deactivateManagedProduct).mockResolvedValue();
  await wrapper.get('.product-confirm button').trigger('click'); await flushPromises();
  expect(wrapper.get('article').text()).toContain('Inactive'); wrapper.unmount();
});
it('hides management and makes no admin request for a reporter', async () => {
  useAuthStore().user!.role = 'reporter';
  const wrapper = mount(ShopManagementView); await flushPromises();
  expect(wrapper.find('section').exists()).toBe(false);
  expect(api.listManagedProducts).not.toHaveBeenCalled(); wrapper.unmount();
});
it('keeps list failures distinct from empty catalogue results', async () => {
  vi.mocked(api.listManagedProducts).mockRejectedValue(new Error('Catalogue denied'));
  const wrapper = mount(ShopManagementView); await flushPromises();
  expect(wrapper.get('[role="alert"]').text()).toContain('Catalogue denied');
  expect(wrapper.text()).not.toContain('No matching products.'); wrapper.unmount();
});
it('focuses the first editable field after a detail response enables the editor', async () => {
  const wrapper = mount(ShopManagementView, { attachTo: document.body }); await flushPromises();
  await wrapper.get('article button').trigger('click'); await flushPromises();
  expect(document.activeElement).toBe(wrapper.get('form').findAll('input')[1]!.element);
  wrapper.unmount();
});
