// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { mount, flushPromises } from '@vue/test-utils';
import { createRouter, createMemoryHistory } from 'vue-router';
import TeamWorkspaceView from '../src/views/app/TeamWorkspaceView.vue';
import SettingsView from '../src/views/app/SettingsView.vue';
import { useAuthStore } from '../src/stores/auth';
import { setLocale } from '../src/i18n';
vi.mock('../src/views/app/TeamAccessView.vue', () => ({ __esModule: true, default: { template: '<p>Existing accounts panel</p>' } }));
vi.mock('../src/views/app/ContractsView.vue', () => ({ __esModule: true, default: { template: '<p>Existing contracts panel</p>' } }));
vi.mock('../src/views/app/SiteRulesView.vue', () => ({ __esModule: true, default: { template: '<p>Existing rules panel</p>' } }));
vi.mock('../src/views/app/TechnicianVerificationReviewView.vue', () => ({ __esModule: true, default: { template: '<p>Existing verification panel</p>' } }));
vi.mock('../src/views/app/SiteApplicationsView.vue', () => ({ __esModule: true, default: { template: '<p>Existing applications panel</p>' } }));
beforeEach(() => { setActivePinia(createPinia()); setLocale('en'); useAuthStore().user = { id: 1, role: 'admin', siteId: 7, firstName: 'Test', lastName: 'Admin', email: 'test@example.invalid', phone: null, address: null }; });
async function render(path: string) { const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/team', component: TeamWorkspaceView }] }); await router.push(path); const wrapper = mount(TeamWorkspaceView, { global: { plugins: [router] } }); await flushPromises(); return { router, wrapper }; }
it('reuses contract and account panels in one role-scoped window', async () => {
 const { router, wrapper } = await render('/team');
 expect(wrapper.text()).toContain('Existing accounts panel');
 expect(wrapper.findAll('nav a').map(x => x.text())).toEqual(['Accounts', 'Contracts', 'Site category']);
 await router.push('/team?tab=contracts'); await flushPromises(); expect(wrapper.text()).toContain('Existing contracts panel'); expect(wrapper.text()).not.toContain('Existing accounts panel');
 wrapper.unmount();
});
it('does not render privileged verification through an administrator query', async () => {
 const { wrapper } = await render('/team?tab=technicians'); expect(wrapper.text()).toContain('Existing accounts panel'); expect(wrapper.text()).not.toContain('Existing verification panel'); wrapper.unmount();
});
it('offers platform reviews only to super administrators', async () => {
 useAuthStore().user!.role = 'super_admin'; const { wrapper } = await render('/team?tab=technicians'); expect(wrapper.text()).toContain('Existing verification panel'); expect(wrapper.findAll('nav a')).toHaveLength(5); wrapper.unmount();
});
it('changes the existing application language from Settings', async () => {
 const wrapper = mount(SettingsView); await wrapper.get('select').setValue('zh-CN'); expect(document.documentElement.lang).toBe('zh-CN'); setLocale('en'); wrapper.unmount();
});
