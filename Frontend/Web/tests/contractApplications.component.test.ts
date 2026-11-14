// @vitest-environment jsdom
import { setLocale } from '../src/i18n';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import ContractApplicationsPanel from '../src/components/technician/ContractApplicationsPanel.vue';
import { useAuthStore } from '../src/stores/auth';
import * as api from '../src/services/access';
import * as termsApi from '../src/services/technician';
import { ApiError } from '../src/services/api';
import type { ContractApplication, TechnicianTermsStatus } from '../src/types/technician';

vi.mock('../src/services/access', () => ({ listContractApplications: vi.fn(), requestTechnicianContract: vi.fn(), decideContractApplication: vi.fn() }));
vi.mock('../src/services/technician', () => ({ getTechnicianTerms: vi.fn(), acceptTechnicianTerms: vi.fn() }));
const application: ContractApplication = {
  id: 93, technicianId: 54, siteId: 71, status: 'pending', note: 'Plumbing work',
  decisionReason: null, decidedByUserId: null, siteFlatFeeMinor: 50000, siteFeeCurrency: 'USD',
  createdAt: '2026-10-29T08:00:00Z', decidedAt: null,
}
const terms: TechnicianTermsStatus = {
  technicianId: 54, currentVersion: 'v3', documentUrl: 'https://example.invalid/terms',
  enforcementRequired: true, acceptedCurrentVersion: true, acceptances: [],
};
let wrapper: VueWrapper;
beforeEach(() => {
  setActivePinia(createPinia()); vi.resetAllMocks();
  useAuthStore().user = { id: 54, role: 'technician', siteId: null,
    firstName: 'Test', lastName: 'Technician', email: 'test@example.invalid', phone: null, address: null };
  vi.mocked(api.listContractApplications).mockResolvedValue([]);
  vi.mocked(api.requestTechnicianContract).mockResolvedValue({ ...application });
  vi.mocked(api.decideContractApplication).mockResolvedValue({ ...application, status: 'approved' });
  vi.mocked(termsApi.getTechnicianTerms).mockResolvedValue({ ...terms });
});
afterEach(() => { wrapper?.unmount(); setLocale('en'); });

describe('contract request screen interactions', () => {
  it('prefills an invitation site without automatically requesting a contract', async () => {
    wrapper = mount(ContractApplicationsPanel, { props: { initialSiteId: 71 } }); await flushPromises();
    expect(wrapper.get<HTMLInputElement>('input[type="number"]').element.value).toBe('71');
    expect(api.requestTechnicianContract).not.toHaveBeenCalled();
  });
  it('submits the site and note, then displays the saved request in history', async () => {
    wrapper = mount(ContractApplicationsPanel); await flushPromises();
    expect(api.listContractApplications).toHaveBeenCalledWith(undefined);
    await wrapper.get('input[type="number"]').setValue('71');
    await wrapper.get('textarea').setValue('Plumbing work');
    await wrapper.get('form').trigger('submit'); await flushPromises();
    expect(api.requestTechnicianContract).toHaveBeenCalledWith(71, 'Plumbing work');
    expect(wrapper.text()).toContain('Request #93 submitted to site #71.');
    expect(wrapper.get('li').text()).toContain('pending');
    expect(wrapper.get<HTMLInputElement>('input[type="number"]').element.value).toBe('');
  });
  it('keeps submission blocked until required terms are accepted', async () => {
    vi.mocked(termsApi.getTechnicianTerms).mockResolvedValue({ ...terms, acceptedCurrentVersion: false });
    wrapper = mount(ContractApplicationsPanel); await flushPromises();
    const requestForm = wrapper.findAll('form')[1]!;
    expect(requestForm.get('fieldset').attributes('disabled')).toBeDefined();
    await requestForm.trigger('submit');
    expect(api.requestTechnicianContract).not.toHaveBeenCalled();
    vi.mocked(termsApi.acceptTechnicianTerms).mockResolvedValue({ ...terms });
    await wrapper.get('input[type="checkbox"]').setValue(true);
    await wrapper.findAll('form')[0]!.trigger('submit'); await flushPromises();
    expect(wrapper.get('form fieldset').attributes('disabled')).toBeUndefined();
  });
  it('refreshes terms after a server conflict and preserves the unfinished request', async () => {
    wrapper = mount(ContractApplicationsPanel); await flushPromises();
    await wrapper.get('input[type="number"]').setValue('71');
    await wrapper.get('textarea').setValue('Plumbing work');
    vi.mocked(api.requestTechnicianContract).mockRejectedValueOnce(new ApiError(409, 'Accept current terms'));
    vi.mocked(termsApi.getTechnicianTerms).mockResolvedValue({ ...terms, currentVersion: 'v4', acceptedCurrentVersion: false });
    await wrapper.get('form').trigger('submit'); await flushPromises();
    expect(termsApi.getTechnicianTerms).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain('version v4');
    expect(wrapper.get<HTMLTextAreaElement>('textarea').element.value).toBe('Plumbing work');
    expect(wrapper.findAll('form')[1]!.get('fieldset').attributes('disabled')).toBeDefined();
  });
  it('lets the target site admin approve with a reason and updates the row', async () => {
    Object.assign(useAuthStore().user!, { role: 'admin', siteId: 71 });
    vi.mocked(api.listContractApplications).mockResolvedValue([{ ...application }]);
    wrapper = mount(ContractApplicationsPanel); await flushPromises();
    expect(api.listContractApplications).toHaveBeenCalledWith(71);
    expect(termsApi.getTechnicianTerms).not.toHaveBeenCalled();
    await wrapper.get('textarea').setValue('Qualifications checked');
    await wrapper.findAll('button').find(button => button.text() === 'Approve request #93')!.trigger('click');
    await flushPromises();
    expect(api.decideContractApplication).toHaveBeenCalledWith(93, 'approve', 'Qualifications checked');
    expect(wrapper.emitted('contractCreated')).toHaveLength(1);
    expect(wrapper.get('li').text()).toContain('approved');
    expect(wrapper.get('li').find('textarea').exists()).toBe(false);
  });
  it('does not expose site-admin request decisions to a super administrator', async () => {
    Object.assign(useAuthStore().user!, { role: 'super_admin', siteId: null });
    wrapper = mount(ContractApplicationsPanel); await flushPromises();
    expect(api.listContractApplications).not.toHaveBeenCalled();
    expect(wrapper.find('section').exists()).toBe(false);
  });
});

it('submits a contract request from Chinese controls without translating its note or identifiers', async () => {
  setLocale('zh-CN'); wrapper = mount(ContractApplicationsPanel); await flushPromises();
  await wrapper.get('input[type="number"]').setValue('71');
  await wrapper.get('textarea').setValue('Original trade experience');
  await wrapper.get('form').trigger('submit'); await flushPromises();
  expect(api.requestTechnicianContract).toHaveBeenCalledWith(71, 'Original trade experience');
  expect(wrapper.text()).toContain('申请 #93 已提交至场地 #71');
  expect(wrapper.get('li').text()).toContain('待审核');
});
it('does not let an outdated optional flag bypass terms acceptance', async () => {
  vi.mocked(termsApi.getTechnicianTerms).mockResolvedValue({ ...terms, enforcementRequired: false, acceptedCurrentVersion: false });
  wrapper = mount(ContractApplicationsPanel); await flushPromises();
  const requestForm = wrapper.findAll('form')[1]!;
  expect(requestForm.get('fieldset').attributes('disabled')).toBeDefined();
  await requestForm.trigger('submit'); expect(api.requestTechnicianContract).not.toHaveBeenCalled();
});
