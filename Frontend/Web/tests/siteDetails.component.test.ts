// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { flushPromises, mount } from '@vue/test-utils';
import { createRouter, createMemoryHistory } from 'vue-router';
import SiteDetailView from '../src/views/app/SiteDetailView.vue';
import { useAuthStore } from '../src/stores/auth';
import { useMaintenanceStore } from '../src/stores/maintenance';
import * as api from '../src/services/siteDetails';
import { site } from './fixtures';
import { setLocale } from '../src/i18n';
vi.mock('../src/services/siteDetails', () => ({ getSite: vi.fn(), getReportingSetup: vi.fn(), getSiteTaxonomy: vi.fn(), getSiteTechnicians: vi.fn(), deleteSite: vi.fn() }));
beforeEach(() => {
  setActivePinia(createPinia()); vi.resetAllMocks(); setLocale('en');
  useAuthStore().user = { id: 1, role: 'super_admin', siteId: null, firstName: 'Test', lastName: 'Admin', email: 'test@example.invalid', phone: null, address: null };
  vi.spyOn(useMaintenanceStore(), 'refresh').mockResolvedValue();
  vi.mocked(api.getSite).mockImplementation(async id => site(id));
  vi.mocked(api.getReportingSetup).mockImplementation(async id => ({ siteId: id, reportingReady: true, activeSubsiteCount: 2 }));
  vi.mocked(api.getSiteTaxonomy).mockResolvedValue([]);
  vi.mocked(api.getSiteTechnicians).mockResolvedValue([{ technicianId: 4, firstName: 'Test', lastName: 'Technician', email: 'tech@example.invalid', availability: 'available', contracted: true }]);
});
async function render() {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/sites/:siteId', component: { template: '<div />' } }, { path: '/sites', component: { template: '<div />' } }, { path: '/sites/:siteId/subsites', name: 'subsites', component: { template: '<div />' } }, { path: '/site-rules', component: { template: '<div />' } }] });
  await router.push('/sites/7');
  const wrapper = mount(SiteDetailView, { global: { plugins: [router] } }); await flushPromises();
  return { wrapper, router };
}
it('loads site-specific setup, taxonomy and authorized pool', async () => {
  const { wrapper } = await render();
  expect(api.getSiteTaxonomy).toHaveBeenCalledWith(7); expect(api.getReportingSetup).toHaveBeenCalledWith(7);
  expect(wrapper.text()).toContain('2 active buildings'); expect(wrapper.text()).toContain('tech@example.invalid'); wrapper.unmount();
});
it('never requests technician contact data or exposes deletion for reporters', async () => {
  useAuthStore().user!.role = 'reporter'; useAuthStore().user!.siteId = 7;
  const { wrapper } = await render();
  expect(api.getSiteTechnicians).not.toHaveBeenCalled();
  expect(wrapper.text()).not.toContain('tech@example.invalid'); expect(wrapper.text()).not.toContain('Delete site');
  expect(wrapper.text()).not.toContain('Contract status'); expect(wrapper.text()).not.toContain('Contracted'); wrapper.unmount();
});
it('requires the exact name and retains details if the server refuses deletion', async () => {
  const { wrapper } = await render();
  await wrapper.findAll('button').find(b => b.text() === 'Review site deletion')!.trigger('click');
  await wrapper.get('form input').setValue('wrong name'); await wrapper.get('form').trigger('submit');
  expect(api.deleteSite).not.toHaveBeenCalled();
  await wrapper.get('form input').setValue('Test site 7');
  vi.mocked(api.deleteSite).mockRejectedValue(new Error('Related records exist'));
  await wrapper.get('form').trigger('submit'); await flushPromises();
  expect(api.deleteSite).toHaveBeenCalledWith(7); expect(wrapper.text()).toContain('Related records exist'); expect(wrapper.get('h1').text()).toBe('Test site 7'); wrapper.unmount();
});
it('does not restore old contact data after navigating to another site', async () => {
  let finish!: (value: api.SiteTechnician[]) => void;
  vi.mocked(api.getSiteTechnicians).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const { wrapper, router } = await render();
  vi.mocked(api.getSiteTechnicians).mockResolvedValue([]);
  await router.push('/sites/8'); await flushPromises();
  finish([{ technicianId: 4, firstName: 'Old', lastName: 'Contact', email: 'old-private@example.invalid', availability: 'available', contracted: true }]); await flushPromises();
  expect(wrapper.get('h1').text()).toBe('Test site 8'); expect(wrapper.text()).not.toContain('old-private@example.invalid'); wrapper.unmount();
});
it('shows setup failure independently of a successful site read', async () => {
  vi.mocked(api.getReportingSetup).mockRejectedValue(new Error('Setup unavailable'));
  const { wrapper } = await render(); expect(wrapper.get('h1').text()).toBe('Test site 7'); expect(wrapper.text()).toContain('Setup unavailable'); wrapper.unmount();
});
it('refuses another site without requesting any of its resources', async () => {
  useAuthStore().user!.role = 'reporter'; useAuthStore().user!.siteId = 7;
  const { wrapper, router } = await render(); await router.push('/sites/8'); await flushPromises();
  expect(wrapper.text()).toContain('not available to your account');
  expect(api.getSite).not.toHaveBeenCalledWith(8); expect(api.getReportingSetup).not.toHaveBeenCalledWith(8);
  expect(wrapper.find('h1').exists()).toBe(false); wrapper.unmount();
});
