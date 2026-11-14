// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { flushPromises, mount } from '@vue/test-utils';
import SiteRulesView from '../src/views/app/SiteRulesView.vue';
import { useAuthStore } from '../src/stores/auth';
import { useMaintenanceStore } from '../src/stores/maintenance';
import * as api from '../src/services/siteRules';
import { setLocale } from '../src/i18n';
vi.mock('../src/services/siteRules', () => ({ listSiteRules: vi.fn(), saveSiteRule: vi.fn(), deleteSiteRule: vi.fn() }));
const rule = { id: 7, siteType: 'school' as const, category: 'plumbing', urgencyWeight: 4, sortOrder: 1 };
beforeEach(() => {
  setActivePinia(createPinia()); vi.resetAllMocks(); setLocale('en');
  useAuthStore().user = { id: 1, role: 'admin', siteId: 7, firstName: 'Test', lastName: 'Admin', email: 'test@example.invalid', phone: null, address: null };
  useMaintenanceStore().sites = [{ id: 7, name: 'School', type: 'school', contractStatus: 'contracted', address: null, description: null, imageUrl: null, contractFlatFeeMinor: 50000, contractFeeCurrency: 'USD', createdAt: '', updatedAt: '' }];
  useMaintenanceStore().selectedSiteId = 7;
  vi.spyOn(useMaintenanceStore(), 'refresh').mockResolvedValue();
  vi.mocked(api.listSiteRules).mockResolvedValue([rule]);
});
it('shows global scope and uses the saved response when editing', async () => {
  const wrapper = mount(SiteRulesView); await flushPromises();
  expect(wrapper.text()).toContain('edits affect those sites too');
  await wrapper.get('li button').trigger('click');
  await wrapper.get('form input').setValue('water');
  vi.mocked(api.saveSiteRule).mockResolvedValue({ ...rule, category: 'water' });
  await wrapper.get('form').trigger('submit'); await flushPromises();
  expect(api.saveSiteRule).toHaveBeenCalledWith(7, { siteType: 'school', category: 'water', urgencyWeight: 4, sortOrder: 1 });
  expect(wrapper.get('li strong').text()).toBe('water'); wrapper.unmount();
});
it('requires a second action to delete and retains a rule on server rejection', async () => {
  const wrapper = mount(SiteRulesView); await flushPromises();
  await wrapper.findAll('li button')[1]!.trigger('click');
  expect(api.deleteSiteRule).not.toHaveBeenCalled();
  vi.mocked(api.deleteSiteRule).mockRejectedValue(new Error('Deletion refused'));
  await wrapper.get('section[aria-label] button').trigger('click'); await flushPromises();
  expect(wrapper.get('[role="alert"]').text()).toContain('Deletion refused');
  expect(wrapper.get('li strong').text()).toBe('plumbing'); wrapper.unmount();
});
it('does not fetch rules or show management controls for a reporter', async () => {
  useAuthStore().user!.role = 'reporter'; const wrapper = mount(SiteRulesView); await flushPromises();
  expect(api.listSiteRules).not.toHaveBeenCalled(); expect(wrapper.find('form').exists()).toBe(false); wrapper.unmount();
});
it('distinguishes load errors from a valid empty list', async () => {
  vi.mocked(api.listSiteRules).mockRejectedValue(new Error('Rules unavailable'));
  const wrapper = mount(SiteRulesView); await flushPromises();
  expect(wrapper.text()).toContain('Rules unavailable'); expect(wrapper.text()).not.toContain('No rules for this site type.'); wrapper.unmount();
});
it('only displays rules for the selected site type and closes an old editor on site change', async () => {
  vi.mocked(api.listSiteRules).mockResolvedValue([rule, { ...rule, id: 8, siteType: 'hotel', category: 'hotel-only' }]);
  const data = useMaintenanceStore();
  data.sites.push({ ...data.sites[0]!, id: 8, name: 'Hotel', type: 'hotel' });
  const wrapper = mount(SiteRulesView); await flushPromises();
  expect(wrapper.text()).not.toContain('hotel-only');
  await wrapper.get('li button').trigger('click');
  data.selectedSiteId = 8; await flushPromises();
  expect(wrapper.find('form').exists()).toBe(false);
  expect(wrapper.findAll('li strong').map(node => node.text())).toEqual(['hotel-only']);
  wrapper.unmount();
});
