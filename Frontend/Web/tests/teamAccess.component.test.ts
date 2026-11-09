// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import AdminApplicationView from '../src/views/app/AdminApplicationView.vue';
import TeamAccessView from '../src/views/app/TeamAccessView.vue';
import { useAccountPolicyStore } from '../src/stores/accountPolicy';
import { useAuthStore } from '../src/stores/auth';
import { useMaintenanceStore } from '../src/stores/maintenance';
import { getSiteAdminApplication, getPendingSiteAdminApplications, decideSiteAdminApplication } from '../src/services/auth';
import { provisionUser } from '../src/services/access';
import { setLocale } from '../src/i18n';
import { site } from './fixtures';
import type { SiteAdminApplication } from '../src/types';
vi.mock('../src/services/auth', () => ({ getSiteAdminApplication: vi.fn(), getPendingSiteAdminApplications: vi.fn(), decideSiteAdminApplication: vi.fn() }));
vi.mock('../src/services/access', () => ({ provisionUser: vi.fn() }));
const application: SiteAdminApplication = { id: 8, userId: 15, siteId: 7, status: 'pending', createdAt: '2026-10-20T12:00:00Z', decidedAt: null, decidedBy: null };
let wrapper: VueWrapper;
const render = () => mount(TeamAccessView, { global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } } });
beforeEach(() => {
  setActivePinia(createPinia()); vi.resetAllMocks(); setLocale('en');
  useAccountPolicyStore().policy = { passwordMinLength: 15, selfRegistrationRoles: ['reporter', 'technician', 'admin'], siteAdminApprovalRequired: true };
  useAuthStore().user = { id: 1, role: 'super_admin', siteId: null, firstName: 'Test', lastName: 'Admin', email: 'admin@example.invalid', phone: null, address: null };
  const data = useMaintenanceStore(); data.sites = [site(7)]; data.selectedSiteId = 7;
  vi.mocked(getPendingSiteAdminApplications).mockResolvedValue([application]);
});
afterEach(() => { wrapper?.unmount(); setLocale('en'); });
describe('site-admin application review', () => {
  it('shows a failed fetch without falsely declaring there are no pending applications', async () => {
    vi.mocked(getPendingSiteAdminApplications).mockRejectedValue(new Error('Application service unavailable'));
    wrapper = render(); await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('Application service unavailable');
    expect(wrapper.text()).not.toContain('No pending applications.');
    vi.mocked(getPendingSiteAdminApplications).mockResolvedValue([]);
    await wrapper.findAll('button').find(button => button.text() === 'Refresh')!.trigger('click'); await flushPromises();
    expect(wrapper.text()).toContain('No pending applications.');
  });
  it('prevents refresh from racing an in-flight decision and restoring a reviewed row', async () => {
    let finish!: (value: SiteAdminApplication) => void;
    vi.mocked(decideSiteAdminApplication).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    wrapper = render(); await flushPromises();
    await wrapper.findAll('button').find(button => button.text() === 'Approve')!.trigger('click');
    const refresh = wrapper.findAll('button').find(button => button.text() === 'Refresh')!;
    expect(refresh.attributes('disabled')).toBeDefined();
    await refresh.trigger('click');
    expect(getPendingSiteAdminApplications).toHaveBeenCalledTimes(1);
    expect(decideSiteAdminApplication).toHaveBeenCalledWith(8, 'approve');
    finish({ ...application, status: 'approved' }); await flushPromises();
    expect(wrapper.text()).not.toContain('Applicant #15');
    expect(wrapper.text()).toContain('No pending applications.');
  });
  it('keeps a failed decision actionable and never removes the applicant as if successful', async () => {
    vi.mocked(decideSiteAdminApplication).mockRejectedValue(new Error('Decision rejected'));
    wrapper = render(); await flushPromises();
    await wrapper.findAll('button').find(button => button.text() === 'Reject')!.trigger('click'); await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('Decision rejected');
    expect(wrapper.text()).toContain('Applicant #15');
    expect(wrapper.findAll('button').find(button => button.text() === 'Approve')!.attributes('disabled')).toBeUndefined();
  });
  it('hides global application review from site administrators', async () => {
    useAuthStore().user!.role = 'admin'; wrapper = render(); await flushPromises();
    expect(getPendingSiteAdminApplications).not.toHaveBeenCalled();
    expect(wrapper.text()).not.toContain('Site-admin applications');
  });
  it('creates a shop manager from Chinese controls with no site assignment', async () => {
    setLocale('zh-CN');
    vi.mocked(provisionUser).mockResolvedValue({ ...useAuthStore().user!, id: 22, role: 'shop_manager', firstName: 'Mei', lastName: 'Chen', email: 'mei@example.invalid', siteId: null });
    wrapper = render(); await flushPromises();
    await wrapper.get('select').setValue('shop_manager');
    const inputs = wrapper.findAll('form input');
    await inputs[0]!.setValue('Mei'); await inputs[1]!.setValue('Chen');
    await inputs[2]!.setValue('mei@example.invalid'); await inputs[3]!.setValue('a unique test passphrase');
    await wrapper.get('form').trigger('submit'); await flushPromises();
    expect(provisionUser).toHaveBeenCalledWith(expect.objectContaining({ role: 'shop_manager', siteId: null, firstName: 'Mei', email: 'mei@example.invalid' }));
    expect(wrapper.get('[role="status"]').text()).toContain('商店管理员');
    expect(wrapper.get('[role="status"]').text()).toContain('Mei Chen');
  });
});

it.each([
  ['pending', '待审核', '等待审批期间，您可以查看申请状态。'],
  ['approved', '已批准', '请退出后重新登录'],
  ['rejected', '已拒绝', '您的申请未获批准'],
] as const)('shows the Chinese %s application status and next steps', async (status, label, guidance) => {
  setLocale('zh-CN');
  vi.mocked(getSiteAdminApplication).mockResolvedValue({ ...application, status });
  wrapper = mount(AdminApplicationView, { global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } } });
  await flushPromises();
  expect(wrapper.text()).toContain('状态：' + label);
  expect(wrapper.text()).toContain(guidance);
  if (status === 'pending') expect(wrapper.text()).not.toContain('目前具有报修人权限');
  expect(wrapper.text()).toContain('2026年10月20日');
});

it('applies the backend password minimum to team-account provisioning', async () => {
  useAccountPolicyStore().policy!.passwordMinLength = 30;
  wrapper = render(); await flushPromises();
  expect(wrapper.get('input[type="password"]').attributes('minlength')).toBe('30');
  const inputs = wrapper.findAll('form input');
  await inputs[0]!.setValue('Test'); await inputs[1]!.setValue('Staff');
  await inputs[2]!.setValue('staff@example.invalid'); await inputs[3]!.setValue('a'.repeat(20));
  await wrapper.get('form').trigger('submit'); await flushPromises();
  expect(provisionUser).not.toHaveBeenCalled();
  expect(wrapper.get('[role="alert"]').text()).toContain('displayed length requirements');
});
