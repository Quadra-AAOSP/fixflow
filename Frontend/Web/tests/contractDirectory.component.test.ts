// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import ContractDirectoryPanel from '../src/components/technician/ContractDirectoryPanel.vue';
import ContractsView from '../src/views/app/ContractsView.vue';
import { useAuthStore } from '../src/stores/auth';
import { useMaintenanceStore } from '../src/stores/maintenance';
import * as api from '../src/services/access';
import * as technicianApi from '../src/services/technician';
import { setLocale } from '../src/i18n';
import { site } from './fixtures';
vi.mock('vue-router', () => ({ useRoute: () => ({ query: {} }) }));
vi.mock('../src/services/access', () => ({ deleteTechnicianContract: vi.fn(), listSiteContracts: vi.fn(), createTechnicianContract: vi.fn(), listContractApplications: vi.fn(), requestTechnicianContract: vi.fn(), decideContractApplication: vi.fn() }));
vi.mock('../src/services/technician', () => ({ getTechnicianTermsFor: vi.fn() }));
const row = { id: 99, technicianId: 54, siteId: 7, createdAt: '2026-10-30T08:00:00Z' };
let wrapper: VueWrapper;
beforeEach(() => {
  setActivePinia(createPinia()); vi.resetAllMocks(); setLocale('en');
  useAuthStore().user = { id: 5, role: 'admin', siteId: 7, firstName: 'Test', lastName: 'Admin', email: 'admin@example.invalid', phone: null, address: null };
  const data = useMaintenanceStore(); data.sites = [site(7), site(8)]; data.selectedSiteId = 7;
  vi.mocked(api.listSiteContracts).mockResolvedValue([row]);
  vi.mocked(api.listContractApplications).mockResolvedValue([]);
});
afterEach(() => { wrapper?.unmount(); setLocale('en'); });
describe('recorded contract directory', () => {
  it('renders actual site-scoped records with Chinese dates and labels', async () => {
    setLocale('zh-CN'); wrapper = mount(ContractDirectoryPanel); await flushPromises();
    expect(api.listSiteContracts).toHaveBeenCalledWith(7);
    expect(wrapper.text()).toContain('合同 #99');
    expect(wrapper.text()).toContain('技术人员 #54');
    expect(wrapper.text()).toContain('2026年10月30日');
  });
  it('keeps load errors distinct from a successful empty contract list', async () => {
    vi.mocked(api.listSiteContracts).mockRejectedValueOnce(new Error('Contract service unavailable'));
    wrapper = mount(ContractDirectoryPanel); await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('Contract service unavailable');
    expect(wrapper.text()).not.toContain('No contracts are recorded');
    vi.mocked(api.listSiteContracts).mockResolvedValue([]);
    await wrapper.findAll('button').find(button => button.text() === 'Refresh contracts')!.trigger('click'); await flushPromises();
    expect(wrapper.text()).toContain('No contracts are recorded for this site.');
  });
  it('discards a late contract response when a super administrator changes sites', async () => {
    useAuthStore().user!.role = 'super_admin';
    let finish!: (value: typeof row[]) => void;
    vi.mocked(api.listSiteContracts).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    wrapper = mount(ContractDirectoryPanel);
    vi.mocked(api.listSiteContracts).mockResolvedValue([]);
    useMaintenanceStore().selectedSiteId = 8; await flushPromises();
    finish([row]); await flushPromises();
    expect(wrapper.text()).toContain('Test site 8');
    expect(wrapper.text()).not.toContain('Contract #99');
    expect(api.listSiteContracts).toHaveBeenLastCalledWith(8);
  });
  it('rejects a response for another site instead of exposing it or claiming an empty list', async () => {
    vi.mocked(api.listSiteContracts).mockResolvedValue([{ ...row, siteId: 8 }]);
    wrapper = mount(ContractDirectoryPanel); await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('did not match the selected site');
    expect(wrapper.find('li').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('No contracts are recorded');
  });
  it.each(['technician', 'reporter', 'staff'] as const)('does not fetch the admin directory for %s accounts', async role => {
    useAuthStore().user!.role = role;
    wrapper = mount(ContractDirectoryPanel); await flushPromises();
    expect(api.listSiteContracts).not.toHaveBeenCalled();
    expect(wrapper.find('section').exists()).toBe(false);
  });
  it('refreshes the recorded list after creating an agreed contract from the actual parent form', async () => {
    vi.mocked(api.listSiteContracts).mockResolvedValueOnce([]).mockResolvedValueOnce([row]);
    vi.mocked(api.createTechnicianContract).mockResolvedValue(row);
    wrapper = mount(ContractsView, { global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } } });
    await flushPromises(); expect(wrapper.text()).toContain('No contracts are recorded');
    await wrapper.get('input[type="number"]').setValue('54');
    await wrapper.get('input[type="checkbox"]').setValue(true);
    await wrapper.get('form').trigger('submit'); await flushPromises();
    expect(api.createTechnicianContract).toHaveBeenCalledWith(54, 7);
    expect(api.listSiteContracts).toHaveBeenCalledTimes(2);
    expect(wrapper.get('.contract-records').text()).toContain('Contract #99');
  });
});

it('does not request another site’s directory for a site administrator', async () => {
  useMaintenanceStore().selectedSiteId = 8;
  wrapper = mount(ContractDirectoryPanel); await flushPromises();
  expect(api.listSiteContracts).not.toHaveBeenCalled();
  expect(wrapper.text()).toContain('Choose an accessible site');
});

it('requires confirmation and retains a contract if removal fails', async () => {
  wrapper = mount(ContractDirectoryPanel); await flushPromises();
  await wrapper.findAll('.contract-records button')[1]!.trigger('click');
  expect(api.deleteTechnicianContract).not.toHaveBeenCalled();
  vi.mocked(api.deleteTechnicianContract).mockRejectedValue(new Error('Removal refused'));
  await wrapper.get('section[aria-label="Remove recorded relationship"] button').trigger('click'); await flushPromises();
  expect(wrapper.get('[role="alert"]').text()).toContain('Removal refused');
  expect(wrapper.get('.contract-records').text()).toContain('Contract #99');
  vi.mocked(api.deleteTechnicianContract).mockResolvedValue();
  await wrapper.get('section[aria-label="Remove recorded relationship"] button').trigger('click'); await flushPromises();
  expect(wrapper.text()).toContain('No contracts are recorded');
});
it('reads technician-specific terms without accepting them on the technician’s behalf', async () => {
  vi.mocked(technicianApi.getTechnicianTermsFor).mockResolvedValue({ technicianId: 54, currentVersion: 'v2', documentUrl: null, enforcementRequired: true, acceptedCurrentVersion: false, acceptances: [] });
  wrapper = mount(ContractDirectoryPanel); await flushPromises();
  await wrapper.get('.contract-records button').trigger('click'); await flushPromises();
  expect(technicianApi.getTechnicianTermsFor).toHaveBeenCalledWith(54);
  expect(wrapper.get('section[aria-label="Technician terms status"]').text()).toContain('Current terms not accepted');
});
it('ignores an old terms response after the selected site changes', async () => {
  useAuthStore().user!.role = 'super_admin';
  let finish!: (value: Awaited<ReturnType<typeof technicianApi.getTechnicianTermsFor>>) => void;
  vi.mocked(technicianApi.getTechnicianTermsFor).mockReturnValue(new Promise(resolve => { finish = resolve; }));
  wrapper = mount(ContractDirectoryPanel); await flushPromises();
  await wrapper.get('.contract-records button').trigger('click');
  vi.mocked(api.listSiteContracts).mockResolvedValue([]);
  useMaintenanceStore().selectedSiteId = 8; await flushPromises();
  finish({ technicianId: 54, currentVersion: 'private-old-version', documentUrl: null, enforcementRequired: true, acceptedCurrentVersion: false, acceptances: [] }); await flushPromises();
  expect(wrapper.text()).not.toContain('private-old-version');
});
