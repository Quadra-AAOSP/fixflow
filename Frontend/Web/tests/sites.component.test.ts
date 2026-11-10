// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import SitesView from '../src/views/app/SitesView.vue';
import { useAuthStore } from '../src/stores/auth';
import { useMaintenanceStore } from '../src/stores/maintenance';
import { site } from './fixtures';
import { setLocale } from '../src/i18n';
beforeEach(() => {
  setActivePinia(createPinia()); setLocale('en');
  useAuthStore().user = { id: 1, role: 'admin', siteId: 7, firstName: 'Site', lastName: 'Admin', email: 'admin@example.invalid', phone: null, address: null };
});
it('sorts sites by location with missing addresses last and never mutates server order', async () => {
  const data = useMaintenanceStore();
  data.sites = [{ ...site(7), name: 'Alpha', address: 'Zulu Road' }, { ...site(8), name: 'Bravo', address: null }, { ...site(9), name: 'Charlie', address: 'Apple Road' }];
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/sites', component: SitesView }] });
  const wrapper = mount(SitesView, { global: { plugins: [router], stubs: { RouterLink: { template: '<a><slot /></a>' } } } });
  const names = () => wrapper.findAll('article h2').map(node => node.text());
  expect(names()).toEqual(['Alpha', 'Bravo', 'Charlie']);
  await wrapper.get('.site-sort select').setValue('location');
  expect(names()).toEqual(['Charlie', 'Alpha', 'Bravo']);
  expect(data.sites.map(item => item.id)).toEqual([7, 8, 9]);
  wrapper.unmount(); vi.restoreAllMocks();
});
