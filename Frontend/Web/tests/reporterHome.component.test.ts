// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { flushPromises, mount } from '@vue/test-utils';
import ReporterHomeView from '../src/views/app/ReporterHomeView.vue';
import { useAuthStore } from '../src/stores/auth';
import { useMaintenanceStore } from '../src/stores/maintenance';
import { setLocale } from '../src/i18n';

let wrapper: ReturnType<typeof mount> | undefined;
beforeEach(() => {
  setActivePinia(createPinia()); setLocale('en');
  useAuthStore().user = { id: 1, role: 'reporter', siteId: 7, firstName: 'Test', lastName: 'Reporter', email: 'test@example.invalid', phone: null, address: null };
  const data = useMaintenanceStore();
  data.sites = [{ id: 7, name: 'Test site', type: 'school', contractStatus: 'uncontracted', address: null, description: null, imageUrl: null, createdAt: '', updatedAt: '' }];
  data.selectedSiteId = 7; data.reportsLoaded = true;
  vi.spyOn(data, 'refresh').mockResolvedValue();
});
afterEach(() => { wrapper?.unmount(); wrapper = undefined; setLocale('en'); });

it('clearly separates personal reports from all site reports', async () => {
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/reporter', component: ReporterHomeView },
    { path: '/reports', component: { template: '<div />' } },
    { path: '/reports/new', component: { template: '<div />' } },
  ] });
  await router.push('/reporter'); await router.isReady();
  wrapper = mount(ReporterHomeView, { global: { plugins: [router] } }); await flushPromises();
  expect(wrapper.get('h1').text()).toBe('My reports');
  expect(wrapper.text()).toContain('issues you reported or joined');
  expect(wrapper.get('a[href="/reports"]').text()).toContain('Browse all site reports');
});
