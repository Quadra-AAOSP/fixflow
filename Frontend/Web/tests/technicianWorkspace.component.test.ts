// @vitest-environment jsdom
import { beforeEach, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import TechnicianView from '../src/views/app/TechnicianView.vue';
import { useAuthStore } from '../src/stores/auth';
import { useMaintenanceStore } from '../src/stores/maintenance';
import { setLocale } from '../src/i18n';
import { report, site } from './fixtures';
beforeEach(() => { setActivePinia(createPinia()); setLocale('en'); useAuthStore().user = { id: 4, role: 'technician', siteId: 7, firstName: 'Test', lastName: 'Technician', email: 'tech@example.invalid', phone: null, address: null }; });
it('links accessible assigned work to reports rather than manager-only assignments', async () => {
  const data = useMaintenanceStore(); data.sites = [site(7)]; data.selectedSiteId = 7; data.reportsLoaded = true;
  data.reports = [report({ assignedTechnicianId: 4 })];
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/technician', component: { template: '<div />' } }, { path: '/reports', component: { template: '<div />' } }, { path: '/profile', component: { template: '<div />' } }, { path: '/contracts', component: { template: '<div />' } }] });
  await router.push('/technician');
  const wrapper = mount(TechnicianView, { global: { plugins: [router], stubs: { TradeProfile: true, TechnicianTermsPanel: true, TechnicianAvailabilityPanel: true } } });
  expect(wrapper.find('a[href="/reports"]').text()).toBe('View assigned reports →');
  expect(wrapper.find('a[href="/assignments"]').exists()).toBe(false); wrapper.unmount();
});
