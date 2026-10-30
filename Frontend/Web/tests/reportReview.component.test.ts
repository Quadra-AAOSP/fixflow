// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import ReportReviewPanel from '../src/components/ReportReviewPanel.vue';
import { useAuthStore } from '../src/stores/auth';
import * as api from '../src/services/maintenance';
import { report } from './fixtures';

vi.mock('../src/services/maintenance', () => ({ confirmReport: vi.fn(), reopenReport: vi.fn() }));
let wrapper: VueWrapper;
beforeEach(() => {
  setActivePinia(createPinia()); vi.resetAllMocks();
  useAuthStore().user = { id: 54, role: 'reporter', siteId: 7,
    firstName: 'Test', lastName: 'Reporter', email: 'test@example.invalid', phone: null, address: null };
});
afterEach(() => wrapper?.unmount());
describe('repair confirmation and reopen interaction', () => {
  it('lets an attached reporter confirm a repair awaiting confirmation', async () => {
    vi.mocked(api.confirmReport).mockResolvedValue(report({ status: 'confirmed' }));
    wrapper = mount(ReportReviewPanel, { props: { report: report({ status: 'resolved_pending_confirmation', createdByUserId: 54 }) } });
    await wrapper.findAll('button').find(button => button.text() === 'Confirm issue is fixed')!.trigger('click'); await flushPromises();
    expect(api.confirmReport).toHaveBeenCalledWith(1);
    expect(wrapper.emitted('saved')?.[0]?.[0]).toMatchObject({ status: 'confirmed' });
  });
  it('submits the supplied reason for reopening a confirmed report', async () => {
    vi.mocked(api.reopenReport).mockResolvedValue(report({ status: 'reopened', reopenReason: 'The leak returned' }));
    wrapper = mount(ReportReviewPanel, { props: { report: report({ status: 'confirmed', createdByUserId: 54 }) } });
    expect(wrapper.text()).not.toContain('Confirm issue is fixed');
    await wrapper.get('textarea').setValue('The leak returned');
    await wrapper.get('form').trigger('submit'); await flushPromises();
    expect(api.reopenReport).toHaveBeenCalledWith(1, 'The leak returned');
    expect(wrapper.emitted('saved')?.[0]?.[0]).toMatchObject({ status: 'reopened' });
  });
  it.each(['reporter', 'technician'] as const)('does not offer repair decisions to an unattached %s', role => {
    useAuthStore().user!.role = role;
    wrapper = mount(ReportReviewPanel, { props: { report: report({ status: 'confirmed' }) } });
    expect(wrapper.find('form').exists()).toBe(false);
  });
  it('keeps a rejected decision visible as an error without claiming success', async () => {
    vi.mocked(api.confirmReport).mockRejectedValue(new Error('Report is no longer awaiting confirmation'));
    wrapper = mount(ReportReviewPanel, { props: { report: report({ status: 'resolved_pending_confirmation', createdByUserId: 54 }) } });
    await wrapper.findAll('button').find(button => button.text() === 'Confirm issue is fixed')!.trigger('click'); await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('no longer awaiting confirmation');
    expect(wrapper.emitted('saved')).toBeUndefined();
  });
});
