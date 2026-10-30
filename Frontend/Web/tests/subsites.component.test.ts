// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { nextTick, reactive } from 'vue';
import SubsitesView from '../src/views/app/SubsitesView.vue';
import { useAuthStore } from '../src/stores/auth';
import { useMaintenanceStore } from '../src/stores/maintenance';
import * as api from '../src/services/maintenance';
import { setLocale } from '../src/i18n';
import { site } from './fixtures';
import type { Subsite } from '../src/types/maintenance';
const routing = vi.hoisted(() => ({ params: { siteId: '7' } }));
vi.mock('vue-router', () => ({ useRoute: () => ({ params: reactive(routing.params) }) }));
vi.mock('../src/services/maintenance', () => ({ listSubsites: vi.fn(), listPendingSubsiteRequests: vi.fn(), createSubsite: vi.fn(), updateSubsite: vi.fn(), archiveSubsite: vi.fn(), resolveSubsiteRequest: vi.fn() }));
const building: Subsite = { id: 42, siteId: 7, label: 'A', name: 'Original Main Building', description: null, archivedAt: null };
let wrapper: VueWrapper;
const render = () => mount(SubsitesView, { global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } } });
beforeEach(() => {
  setActivePinia(createPinia()); vi.resetAllMocks(); setLocale('en'); routing.params.siteId = '7';
  useAuthStore().user = { id: 1, role: 'super_admin', siteId: null, firstName: 'Test', lastName: 'Admin', email: 'admin@example.invalid', phone: null, address: null };
  const data = useMaintenanceStore(); data.sites = [site(7), site(8)]; data.selectedSiteId = 7;
  vi.mocked(api.listSubsites).mockResolvedValue([building]); vi.mocked(api.listPendingSubsiteRequests).mockResolvedValue([]);
});
afterEach(() => { wrapper?.unmount(); setLocale('en'); });
describe('labelled building management', () => {
  it('saves a building from Chinese controls and retranslates success without changing its name', async () => {
    setLocale('zh-CN');
    let submitted: unknown;
    vi.mocked(api.createSubsite).mockImplementation(async (siteId, value) => { submitted = { siteId, ...value }; return { ...building, id: 43, label: 'B', name: 'Original Annex' }; });
    wrapper = render(); await flushPromises();
    expect(wrapper.get('h1').text()).toBe('楼宇与地点');
    await wrapper.get('input[maxlength="64"]').setValue('B');
    await wrapper.get('input[maxlength="255"]').setValue('Original Annex');
    await wrapper.get('form').trigger('submit'); await flushPromises();
    expect(submitted).toEqual({ siteId: 7, label: 'B', name: 'Original Annex', description: '' });
    expect(wrapper.text()).toContain('Original Annex');
    expect(wrapper.get('[role="status"]').text()).toContain('已为 Test site 7 保存 B · Original Annex');
    setLocale('en'); await nextTick();
    expect(wrapper.get('[role="status"]').text()).toContain('B · Original Annex saved for Test site 7.');
  });
  it('does not show zero pending requests after a request-list failure', async () => {
    vi.mocked(api.listPendingSubsiteRequests).mockRejectedValue(new Error('Request list unavailable'));
    wrapper = render(); await flushPromises();
    expect(wrapper.text()).toContain('Request list unavailable');
    expect(wrapper.text()).not.toContain('0 pending');
    expect(wrapper.text()).not.toContain('No pending building requests.');
  });
  it('never adds a late save to a different site or after leaving and returning to the same site', async () => {
    let finish!: (row: Subsite) => void;
    vi.mocked(api.createSubsite).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    wrapper = render(); await flushPromises();
    await wrapper.get('input[maxlength="64"]').setValue('B');
    await wrapper.get('input[maxlength="255"]').setValue('Late Annex');
    await wrapper.get('form').trigger('submit');
    reactive(routing.params).siteId = '8'; await flushPromises();
    reactive(routing.params).siteId = '7'; await flushPromises();
    finish({ ...building, id: 43, name: 'Late Annex' }); await flushPromises();
    expect(wrapper.text()).not.toContain('Late Annex');
    expect(wrapper.find('[role="status"]').exists()).toBe(false);
  });
  it('shows buildings to reporters without management controls or private requests', async () => {
    useAuthStore().user!.role = 'reporter'; useAuthStore().user!.siteId = 7;
    wrapper = render(); await flushPromises();
    expect(wrapper.text()).toContain('Original Main Building');
    expect(wrapper.find('form').exists()).toBe(false);
    expect(api.listPendingSubsiteRequests).not.toHaveBeenCalled();
    expect(wrapper.find('button[aria-label="Archive Original Main Building"]').exists()).toBe(false);
  });
});
