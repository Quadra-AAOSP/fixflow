// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { mount, flushPromises } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import { useAuthStore } from '../src/stores/auth';
import { markNoticesSeen } from '../src/utils/notificationSeen';

const feeds = vi.hoisted(() => ({ reports: [] as { id: number }[], shop: [] as { id: number }[], failReports: false, failShop: false }));
vi.mock('../src/services/notifications', () => ({ listNotifications: async () => {
  if (feeds.failReports) throw new Error('reports unavailable');
  return { content: feeds.reports, hasMore: false };
} }));
vi.mock('../src/services/shop', () => ({ listShopNotifications: async () => {
  if (feeds.failShop) throw new Error('shop unavailable');
  return { content: feeds.shop, hasMore: false };
} }));
import { useNotificationIndicator } from '../src/composables/useNotificationIndicator';

const Probe = defineComponent({ setup() { const { hasUnread, refresh } = useNotificationIndicator(); return () => h('div', [h('span', { 'data-testid': 'dot', 'data-unread': String(hasUnread.value) }), h('button', { onClick: refresh })]); } });
const reporter = (id: number) => ({ id, role: 'reporter' as const, firstName: 'Test', lastName: 'User', email: 'test@example.invalid', phone: null, address: null, siteId: null });
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

describe('notification indicator lifecycle', () => {
  it('shows new notices, clears after a successfully displayed feed is marked seen', async () => {
    localStorage.clear(); feeds.reports = [{ id: 90401 }]; feeds.shop = []; feeds.failReports = false; feeds.failShop = false;
    setActivePinia(createPinia()); useAuthStore().user = reporter(90401);
    const wrapper = mount(Probe); await flushPromises();
    expect(wrapper.get('[data-testid="dot"]').attributes('data-unread')).toBe('true');
    await markNoticesSeen(90401, 'reports', feeds.reports); await flushPromises();
    expect(wrapper.get('[data-testid="dot"]').attributes('data-unread')).toBe('false');
    wrapper.unmount();
  });

  it('retains the dot on partial feed failure and isolates account changes', async () => {
    localStorage.clear(); feeds.reports = [{ id: 90402 }]; feeds.shop = []; feeds.failReports = false; feeds.failShop = false;
    setActivePinia(createPinia()); const auth = useAuthStore(); auth.user = reporter(90402);
    const wrapper = mount(Probe); await flushPromises();
    expect(wrapper.get('[data-testid="dot"]').attributes('data-unread')).toBe('true');
    feeds.failReports = true; await wrapper.get('button').trigger('click'); await flushPromises();
    expect(wrapper.get('[data-testid="dot"]').attributes('data-unread')).toBe('true');
    feeds.failReports = false; feeds.reports = []; auth.user = reporter(90403); await flushPromises();
    expect(wrapper.get('[data-testid="dot"]').attributes('data-unread')).toBe('false');
    wrapper.unmount();
  });
});
