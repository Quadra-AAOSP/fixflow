// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import TechnicianInvitationsView from '../src/views/app/TechnicianInvitationsView.vue';
import TechnicianInvitationSender from '../src/components/technician/TechnicianInvitationSender.vue';
import { useAuthStore } from '../src/stores/auth';
import * as api from '../src/services/technician';
import { report } from './fixtures';

vi.mock('../src/services/technician', () => ({ getTechnicianInvitations: vi.fn(), sendTechnicianInvitations: vi.fn() }));
let wrapper: VueWrapper;
beforeEach(() => {
  setActivePinia(createPinia()); vi.resetAllMocks();
  useAuthStore().user = { id: 54, role: 'technician', siteId: null,
    firstName: 'Test', lastName: 'Technician', email: 'test@example.invalid', phone: null, address: null };
  vi.mocked(api.getTechnicianInvitations).mockResolvedValue({ page: 0, hasNext: true, items: [
    { id: 7, siteId: 71, category: 'plumbing', specialty: null, reason: 'We need plumbing expertise', createdAt: '2026-10-30T08:00:00Z' },
  ] });
});
afterEach(() => wrapper?.unmount());
describe('technician invitation screens', () => {
  it('shows the authorized inbox and links to a contract review with the supplied site ID', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/contracts', name: 'contracts', component: { template: '<div />' } },
    ] });
    await router.push('/');
    wrapper = mount(TechnicianInvitationsView, { global: { plugins: [router] } }); await flushPromises();
    expect(api.getTechnicianInvitations).toHaveBeenCalledWith(0);
    expect(wrapper.text()).toContain('We need plumbing expertise');
    expect(wrapper.get('a').attributes('href')).toBe('/contracts?siteId=71');
    vi.mocked(api.getTechnicianInvitations).mockResolvedValue({ page: 1, hasNext: false, items: [] });
    await wrapper.findAll('button').find(button => button.text() === 'Next')!.trigger('click'); await flushPromises();
    expect(api.getTechnicianInvitations).toHaveBeenLastCalledWith(1);
    expect(wrapper.text()).toContain('Page 2');
    expect(wrapper.findAll('button').find(button => button.text() === 'Next')!.attributes('disabled')).toBeDefined();
  });
  it('sends admin invitation batches one at a time using returned pagination', async () => {
    Object.assign(useAuthStore().user!, { role: 'admin', siteId: 7 });
    vi.mocked(api.sendTechnicianInvitations).mockResolvedValueOnce({ created: 4, page: 0, hasNext: true })
      .mockResolvedValueOnce({ created: 2, page: 1, hasNext: false });
    wrapper = mount(TechnicianInvitationSender, { props: { report: report() } });
    await wrapper.get('textarea').setValue('Additional plumbing expertise needed');
    await wrapper.get('form').trigger('submit'); await flushPromises();
    expect(api.sendTechnicianInvitations).toHaveBeenCalledWith(1, 'Additional plumbing expertise needed', 0);
    expect(wrapper.text()).toContain('Created 4 invitations from batch 1');
    expect(api.sendTechnicianInvitations).toHaveBeenCalledTimes(1);
    await wrapper.get('form').trigger('submit'); await flushPromises();
    expect(api.sendTechnicianInvitations).toHaveBeenLastCalledWith(1, 'Additional plumbing expertise needed', 1);
    expect(wrapper.text()).toContain('Created 2 invitations from batch 2');
    expect(wrapper.get('fieldset').attributes('disabled')).toBeDefined();
  });
  it('does not display invitation sending controls to staff', async () => {
    useAuthStore().user!.role = 'staff';
    wrapper = mount(TechnicianInvitationSender, { props: { report: report() } });
    expect(wrapper.find('form').exists()).toBe(false);
    expect(api.sendTechnicianInvitations).not.toHaveBeenCalled();
  });
});
