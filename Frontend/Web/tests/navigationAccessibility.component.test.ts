// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { defineComponent, nextTick } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import AppLayout from '../src/layouts/AppLayout.vue';
import { usePageNavigation } from '../src/composables/usePageNavigation';
import { useAuthStore } from '../src/stores/auth';
import { useMaintenanceStore } from '../src/stores/maintenance';
import { useRealtimeStore } from '../src/stores/realtime';
import { setLocale } from '../src/i18n';
import * as notifications from '../src/services/notifications';
const media = { matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() };
const showModal = vi.fn(function(this: HTMLDialogElement) { this.setAttribute('open', ''); });
const close = vi.fn(function(this: HTMLDialogElement) { this.removeAttribute('open'); this.dispatchEvent(new Event('close')); });
let wrapper: VueWrapper;
beforeEach(() => {
  setActivePinia(createPinia()); vi.clearAllMocks(); setLocale('en');
  vi.stubGlobal('matchMedia', vi.fn(() => media));
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: showModal });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: close });
  useAuthStore().user = { id: 1, role: 'reporter', siteId: 7, firstName: 'Test', lastName: 'Reporter', email: 'test@example.invalid', phone: null, address: null };
  vi.spyOn(useMaintenanceStore(), 'refresh').mockResolvedValue();
});
afterEach(() => { wrapper?.unmount(); setLocale('en'); vi.unstubAllGlobals(); vi.restoreAllMocks(); document.body.innerHTML = ''; });
async function render() {
  const Page = { template: '<div><h1>Page</h1><input aria-label="Page field" /></div>' };
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/building-suggestions', name: 'building-suggestions', component: Page },
    { path: '/profile', name: 'profile', component: Page }, { path: '/reports', name: 'reports', component: Page },
    { path: '/reports/:id', name: 'report-detail', component: Page }, { path: '/', name: 'home', component: Page },
    { path: '/:pathMatch(.*)*', component: Page },
  ] });
  await router.push('/profile');
  const Root = defineComponent({ components: { AppLayout }, setup() { usePageNavigation(); }, template: '<AppLayout />' });
  wrapper = mount(Root, { attachTo: document.body, global: { plugins: [router] } }); await flushPromises();
  return router;
}
describe('workspace keyboard navigation', () => {
  it('connects the menu trigger to a native modal and resets expanded state on close', async () => {
    await render();
    const trigger = wrapper.get('button[aria-controls="mobile-navigation"]');
    expect(trigger.attributes('aria-expanded')).toBe('false');
    await trigger.trigger('click');
    expect(showModal).toHaveBeenCalledTimes(1);
    expect(wrapper.get('#mobile-navigation').attributes('open')).toBeDefined();
    expect(trigger.attributes('aria-expanded')).toBe('true');
    await wrapper.get('#mobile-navigation button').trigger('click');
    expect(trigger.attributes('aria-expanded')).toBe('false');
    expect(wrapper.get('#mobile-navigation').attributes('open')).toBeUndefined();
  });
  it('closes the mobile drawer and focuses the content landmark after a navigation link', async () => {
    const router = await render();
    await wrapper.get('button[aria-controls]').trigger('click');
    await wrapper.get('#mobile-navigation a[href="/building-suggestions"]').trigger('click'); await flushPromises();
    expect(router.currentRoute.value.name).toBe('building-suggestions');
    expect(wrapper.get('#mobile-navigation').attributes('open')).toBeUndefined();
    expect(document.activeElement).toBe(wrapper.get('#main-content').element);
    expect(document.title).toBe('My building suggestions · FixFlow');
    expect(wrapper.get('.skip-link').attributes('href')).toBe('#main-content');
  });
  it('keeps focus in the current control for query or language changes', async () => {
    const router = await render();
    const field = wrapper.get<HTMLInputElement>('input[aria-label="Page field"]'); field.element.focus();
    await router.push('/profile?q=water'); await flushPromises();
    expect(document.activeElement).toBe(field.element);
    setLocale('zh-CN'); await nextTick();
    expect(document.title).toBe('个人资料 · FixFlow');
    expect(document.activeElement).toBe(field.element);
    expect(wrapper.get('.skip-link').text()).toBe('跳至主要内容');
  });
  it('closes a mobile modal when switching to the desktop breakpoint', async () => {
    await render(); await wrapper.get('button[aria-controls]').trigger('click');
    const listener = media.addEventListener.mock.calls[0]![1];
    media.matches = false; listener(); await nextTick();
    expect(wrapper.get('#mobile-navigation').attributes('open')).toBeUndefined(); media.matches = true;
  });
  it('retains role-scoped navigation in both desktop and mobile menus', async () => {
    useAuthStore().user!.role = 'technician'; useAuthStore().user!.siteId = null;
    await render();
    for (const selector of ['.desktop-sidebar', '#mobile-navigation']) {
      expect(wrapper.find(`${selector} a[href="/technician/invitations"]`).exists()).toBe(false);
      expect(wrapper.find(`${selector} a[href="/contracts"]`).exists()).toBe(true);
      expect(wrapper.find(`${selector} a[href="/team-access"]`).exists()).toBe(false);
      expect(wrapper.find(`${selector} a[href="/reports"]`).exists()).toBe(false);
    }
  });
  it('keeps additional destinations behind More and returns keyboard focus when it closes', async () => {
    useAuthStore().user!.role = 'super_admin';
    useAuthStore().user!.siteId = null;
    await render();
    for (const selector of ['.desktop-sidebar', '#mobile-navigation']) {
      const nav = wrapper.get(`${selector} nav`);
      expect(nav.element.children).toHaveLength(3);
      expect(nav.find(':scope > a[href="/site-applications"]').exists()).toBe(false);
      expect(nav.get('details a[href="/site-applications"]').exists()).toBe(true);
    }
    const more = wrapper.get('.desktop-sidebar details');
    expect(more.attributes('open')).toBeUndefined();
    more.element.setAttribute('open', '');
    const link = more.get('a[href="/site-applications"]');
    (link.element as HTMLElement).focus();
    await link.trigger('keydown', { key: 'Escape' });
    expect(more.attributes('open')).toBeUndefined();
    expect(document.activeElement).toBe(more.get('summary').element);
  });
});
it('does not offer maintenance search and retains the shop notification inbox on the shop-manager profile', async () => {
  useAuthStore().user!.role = 'shop_manager'; await render();
  expect(wrapper.find('form[role="search"]').exists()).toBe(false);
  expect(wrapper.find('button[aria-label="Notifications"]').exists()).toBe(true);
});
it('opens the inbox for a technician without a selected site and displays report changes', async () => {
  useAuthStore().user!.role = 'technician';
  useAuthStore().user!.siteId = null;
  const load = vi.spyOn(notifications, 'listNotifications').mockResolvedValue({
    content: [
      { id: 3, reportId: null, invitationId: 42, type: 'site_invitation', createdAt: '2026-11-06T08:00:00Z' },
      { id: 2, reportId: 81, type: 'report_deleted', createdAt: '2026-11-06T07:00:00Z' },
      { id: 1, reportId: 80, type: 'report_edited', createdAt: '2026-11-06T06:00:00Z' },
    ],
    hasMore: false,
  });
  await render();
  await wrapper.get('button[aria-label^="Notifications"]').trigger('click');
  await flushPromises();
  expect(load).toHaveBeenCalledWith(0);
  const inbox = wrapper.get('dialog[aria-label="Notifications"]');
  expect(inbox.attributes('open')).toBeDefined();
  expect(inbox.get('a[href="/technician/invitations?invitationId=42"]').text()).toContain('Site invitations');
  expect(inbox.text()).toContain('Report #81 was archived.');
  expect(inbox.text()).toContain('Report #80 was edited.');
});
it('keeps independent technicians away from unavailable report searches until a site is accessible', async () => {
  useAuthStore().user!.role = 'technician'; useAuthStore().user!.siteId = null;
  await render(); expect(wrapper.find('form[role="search"]').exists()).toBe(false);
  const data = useMaintenanceStore();
  data.sites = [{ id: 7, name: 'Accessible fixture', type: 'school', contractStatus: 'contracted', address: null, description: null, imageUrl: null, createdAt: '', updatedAt: '' }];
  data.selectedSiteId = 7; await nextTick();
  expect(wrapper.find('form[role="search"]').exists()).toBe(true);
});

it('offers manual updates only while live updates are disconnected', async () => {
  await render();
  const realtime = useRealtimeStore();
  realtime.state = 'offline'; await nextTick();
  expect(wrapper.find('.manual-sync').exists()).toBe(true);
  await wrapper.get('.manual-sync').trigger('click');
  expect(useMaintenanceStore().refresh).toHaveBeenCalled();
  realtime.state = 'connected'; await nextTick();
  expect(wrapper.find('.manual-sync').exists()).toBe(false);
});
