// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { createMemoryHistory, createRouter, RouterView } from 'vue-router';
import ShopLayout from '../src/layouts/ShopLayout.vue';
import { useAuthStore } from '../src/stores/auth';
import { useMaintenanceStore } from '../src/stores/maintenance';
import { setLocale } from '../src/i18n';
import { listShopNotifications } from '../src/services/shop';
import { listNotifications } from '../src/services/notifications';
vi.mock('../src/services/shop', () => ({ listShopNotifications: vi.fn() }));
vi.mock('../src/services/notifications', () => ({ listNotifications: vi.fn() }));
let wrapper: VueWrapper;
beforeEach(() => {
  setActivePinia(createPinia()); vi.resetAllMocks(); setLocale('en');
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  vi.spyOn(useMaintenanceStore(), 'refresh').mockResolvedValue();
  vi.mocked(listShopNotifications).mockResolvedValue({ content: [], hasMore: false });
  vi.mocked(listNotifications).mockResolvedValue({ content: [], hasMore: false });
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value(this: HTMLDialogElement) { this.setAttribute('open', ''); } });
});
afterEach(() => { wrapper?.unmount(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
async function render() {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/shop', component: ShopLayout, children: [{ path: '', component: { template: '<h1>Catalogue content</h1>' } }] }, { path: '/:pathMatch(.*)*', component: { template: '<div />' } }] });
  await router.push('/shop'); await router.isReady();
  wrapper = mount(RouterView, { global: { plugins: [router] } }); await flushPromises();
}
it('renders catalogue content inside the common workspace navigation for a signed-in technician', async () => {
  useAuthStore().user = { id: 1, role: 'technician', siteId: null, firstName: 'Test', lastName: 'Buyer', email: 'test@example.invalid', phone: null, address: null };
  await render();
  expect(wrapper.find('.dashboard-sidebar').exists()).toBe(true);
  expect(wrapper.find('.dashboard-topbar').exists()).toBe(true);
  expect(wrapper.get('#main-content h1').text()).toBe('Catalogue content');
  expect(wrapper.find('.shop-guest-header').exists()).toBe(false);
  expect(wrapper.find('.live-toolbar').exists()).toBe(false);
  expect(wrapper.find('form[role="search"]').exists()).toBe(false);
});
it('preserves shop-manager notifications without requesting report notifications', async () => {
  useAuthStore().user = { id: 1, role: 'shop_manager', siteId: null, firstName: 'Test', lastName: 'Manager', email: 'test@example.invalid', phone: null, address: null };
  await render();
  await wrapper.get('button[aria-label="Notifications"]').trigger('click'); await flushPromises();
  expect(wrapper.get('dialog[aria-label="Notifications"]').text()).toContain('Shop notifications');
  expect(listNotifications).not.toHaveBeenCalled();
});
it('does not render catalogue content for a guest during session transitions', async () => {
  await render();
  expect(wrapper.find('#main-content').exists()).toBe(false);
  expect(wrapper.text()).not.toContain('Catalogue content');
  expect(wrapper.find('.dashboard-sidebar').exists()).toBe(false);
});
