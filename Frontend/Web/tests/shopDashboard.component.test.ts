// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { flushPromises, mount } from '@vue/test-utils';
import View from '../src/views/app/ShopDashboardView.vue';
import { useAuthStore } from '../src/stores/auth';
import { getShopAnalytics } from '../src/services/shopAdmin';
import { setLocale } from '../src/i18n';
vi.mock('../src/services/shopAdmin', () => ({ getShopAnalytics: vi.fn() }));
const data = { generatedAt: '', trendStartDate: '2026-01-01', trendEndDate: '2026-01-01', totalOrders: 2, ordersByStatus: { pending_payment: 1, paid: 1, cancelled: 0, refunded: 0, fulfilled: 0 }, revenue: [{ currency: 'USD', minorUnitDigits: 2, totalMinor: 1250 }, { currency: 'JPY', minorUnitDigits: 0, totalMinor: 500 }], products: { total: 1, active: 1, inStock: 0, outOfStock: 1 }, daily: [{ date: '2026-01-01', orders: 2, revenue: [] }] };
beforeEach(() => { setActivePinia(createPinia()); setLocale('en'); vi.resetAllMocks(); useAuthStore().user = { id: 4, role: 'shop_manager', siteId: null, firstName: 'Shop', lastName: 'Manager', email: 'test@example.invalid', phone: null, address: null }; });
it('shows server figures and separates currencies', async () => { vi.mocked(getShopAnalytics).mockResolvedValue(data); const w = mount(View); await flushPromises(); expect(w.text()).toContain('12.50'); expect(w.text()).toContain('500'); expect(w.text()).toContain('Pending payment'); expect(w.text()).toContain('2026-01-01'); w.unmount(); });
it('retries an error and clears data when the role changes', async () => { vi.mocked(getShopAnalytics).mockRejectedValueOnce(new Error()).mockResolvedValue(data); const w = mount(View); await flushPromises(); expect(w.find('[role="alert"]').exists()).toBe(true); await w.get('[role="alert"] button').trigger('click'); await flushPromises(); expect(w.text()).toContain('12.50'); useAuthStore().user!.role = 'reporter'; await flushPromises(); expect(w.text()).not.toContain('12.50'); expect(getShopAnalytics).toHaveBeenCalledTimes(2); w.unmount(); });
