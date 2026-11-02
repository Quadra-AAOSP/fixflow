// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import RegisterView from '../src/views/auth/RegisterView.vue';
import { getAccountPolicy } from '../src/services/accountPolicy';
import * as auth from '../src/services/auth';
import { setLocale } from '../src/i18n';
vi.mock('../src/services/accountPolicy', () => ({ getAccountPolicy: vi.fn() }));
vi.mock('../src/services/auth', () => ({ register: vi.fn(), login: vi.fn() }));
const policy = { passwordMinLength: 20, selfRegistrationRoles: ['reporter', 'technician', 'admin'], siteAdminApprovalRequired: true };
const user = { id: 54, role: 'reporter' as const, siteId: 7, firstName: 'Test', lastName: 'Reporter', email: 'test@example.invalid', phone: null, address: null };
let wrapper: VueWrapper;
beforeEach(() => {
  setActivePinia(createPinia()); vi.resetAllMocks(); setLocale('en');
  vi.mocked(getAccountPolicy).mockResolvedValue({ ...policy });
  vi.mocked(auth.register).mockResolvedValue(user); vi.mocked(auth.login).mockResolvedValue(user);
});
afterEach(() => { wrapper?.unmount(); setLocale('en'); document.body.innerHTML = ''; });
async function render() {
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/register', component: { template: '<div />' } }, { path: '/', component: { template: '<div />' } },
    { path: '/admin-application', name: 'admin-application', component: { template: '<div />' } },
    { path: '/login', component: { template: '<div />' } }, { path: '/access-policy', component: { template: '<div />' } },
  ] });
  await router.push('/register'); wrapper = mount(RegisterView, { attachTo: document.body, global: { plugins: [router] } }); await flushPromises(); return router;
}
async function fill(password: string) {
  await wrapper.get('input[autocomplete="given-name"]').setValue('Test');
  await wrapper.get('input[autocomplete="family-name"]').setValue('Reporter');
  await wrapper.get('input[type="email"]').setValue('test@example.invalid');
  await wrapper.get('input[type="password"]').setValue(password);
  await wrapper.get('input[type="number"]').setValue('7');
}
describe('registration from backend policy', () => {
  it('loads policy before showing signup and retries an unavailable policy without fallback values', async () => {
    vi.mocked(getAccountPolicy).mockRejectedValueOnce(new Error('Policy temporarily unavailable'));
    await render(); expect(wrapper.get('[role="alert"]').text()).toContain('Policy temporarily unavailable');
    expect(wrapper.find('.role-option').exists()).toBe(false);
    await wrapper.findAll('button').find(button => button.text() === 'Retry')!.trigger('click'); await flushPromises();
    expect(wrapper.findAll('.role-option')).toHaveLength(2);
    expect(getAccountPolicy).toHaveBeenCalledTimes(2); expect(auth.register).not.toHaveBeenCalled();
  });
  it('uses the returned minimum in Chinese guidance, native validation and payload validation', async () => {
    setLocale('zh-CN'); await render();
    await wrapper.findAll('.role-option')[0]!.trigger('click');
    expect(wrapper.get('input[type="password"]').attributes('minlength')).toBe('20');
    expect(wrapper.text()).toContain('请使用 20 至 100 个字符');
    await fill('a'.repeat(19)); await wrapper.get('form').trigger('submit'); await flushPromises();
    expect(auth.register).not.toHaveBeenCalled();
    expect(wrapper.get('[role="alert"]').text()).toContain('符合页面所示长度要求');
    await wrapper.get('input[type="password"]').setValue('a'.repeat(20));
    await wrapper.get('form').trigger('submit'); await flushPromises();
    expect(auth.register).toHaveBeenCalledWith(expect.objectContaining({ role: 'reporter', siteId: 7, password: 'a'.repeat(20) }));
  });
  it('offers only supported roles advertised by the backend and never self-enrolls privileged accounts', async () => {
    vi.mocked(getAccountPolicy).mockResolvedValue({ ...policy, selfRegistrationRoles: ['technician', 'super_admin'] });
    await render(); expect(wrapper.findAll('.role-option')).toHaveLength(1);
    expect(wrapper.get('.role-option').text()).toContain('I’m a technician');
    await wrapper.findAll('button').find(button => button.text() === 'Super administrator')!.trigger('click');
    expect(wrapper.text()).toContain('Privileged access requires verification');
    expect(wrapper.find('form').exists()).toBe(false); expect(auth.register).not.toHaveBeenCalled();
  });
  it('keeps site-admin self-registration unavailable if required approval is not advertised', async () => {
    vi.mocked(getAccountPolicy).mockResolvedValue({ ...policy, siteAdminApprovalRequired: false });
    await render(); await wrapper.findAll('button').find(button => button.text() === 'Site administrator')!.trigger('click');
    expect(wrapper.find('form').exists()).toBe(false);
    expect(wrapper.text()).toContain('Self-registration for this role is unavailable');
  });
  it('routes the new account using the authenticated server response and its application status', async () => {
    vi.mocked(auth.login).mockResolvedValue({ ...user, adminApplication: { id: 9, status: 'pending' } });
    const router = await render();
    await wrapper.findAll('button').find(button => button.text() === 'Site administrator')!.trigger('click');
    await fill('a'.repeat(20)); await wrapper.get('form').trigger('submit'); await flushPromises();
    expect(auth.register).toHaveBeenCalledWith(expect.objectContaining({ role: 'admin', siteId: 7 }));
    expect(router.currentRoute.value.name).toBe('admin-application');
  });
});

it('moves focus into the selected role and restores its choice when going back', async () => {
  await render();
  await wrapper.get('[data-role="technician"]').trigger('click'); await flushPromises();
  expect(document.activeElement).toBe(wrapper.get('.chosen-role').element);
  await wrapper.get('.registration-back').trigger('click'); await flushPromises();
  expect(document.activeElement).toBe(wrapper.get('[data-role="technician"]').element);
});
