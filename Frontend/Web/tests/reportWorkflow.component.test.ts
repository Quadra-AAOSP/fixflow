// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import ReportWorkflowPanel from '../src/components/ReportWorkflowPanel.vue';
import { useAuthStore } from '../src/stores/auth';
import * as api from '../src/services/reportWorkflow';
import { report } from './fixtures';
vi.mock('../src/services/reportWorkflow', () => ({ startReport: vi.fn(), resolveReport: vi.fn(), escalateReport: vi.fn(), overrideReportUrgency: vi.fn(), listWorkflowHistory: vi.fn(), listWorkflowResolutions: vi.fn(), listWorkflowRatings: vi.fn(), rateReportResolution: vi.fn() }));
let wrapper: VueWrapper;
beforeEach(() => {
  setActivePinia(createPinia()); vi.resetAllMocks();
  useAuthStore().user = { id: 54, role: 'technician', siteId: null, firstName: 'Test', lastName: 'Tech', email: 'test@example.invalid', phone: null, address: null };
  vi.mocked(api.listWorkflowHistory).mockResolvedValue([]); vi.mocked(api.listWorkflowResolutions).mockResolvedValue([]); vi.mocked(api.listWorkflowRatings).mockResolvedValue([]);
});
afterEach(() => wrapper?.unmount());
const render = async (value = report({ status: 'assigned', assignedTechnicianId: 54 })) => {
  wrapper = mount(ReportWorkflowPanel, { props: { report: value }, global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } } }); await flushPromises();
};
it('lets only the assigned technician start work and emits the saved server result', async () => {
  vi.mocked(api.startReport).mockResolvedValue(report({ status: 'in_progress', assignedTechnicianId: 54 }));
  await render();
  expect(wrapper.text()).not.toContain('Override final urgency');
  await wrapper.findAll('button').find(button => button.text() === 'Start work')!.trigger('click'); await flushPromises();
  expect(api.startReport).toHaveBeenCalledWith(1);
  expect(wrapper.emitted('saved')?.[0]?.[0]).toMatchObject({ status: 'in_progress' });
  await wrapper.setProps({ report: report({ status: 'assigned', assignedTechnicianId: 99 }) }); await flushPromises();
  expect(wrapper.text()).not.toContain('Start work');
});
it('submits technician resolution details and leaves status unchanged on conflict', async () => {
  vi.mocked(api.resolveReport).mockRejectedValue(new Error('Only work in progress can be resolved'));
  await render(report({ status: 'in_progress', assignedTechnicianId: 54 }));
  const form = wrapper.findAll('form').find(form => form.text().includes('Submit resolution'))!;
  await form.get('textarea').setValue('Replaced the damaged pipe.'); await form.trigger('submit'); await flushPromises();
  expect(api.resolveReport).toHaveBeenCalledWith(1, 'Replaced the damaged pipe.');
  expect(wrapper.get('[role="alert"]').text()).toContain('Only work in progress');
  expect(wrapper.emitted('saved')).toBeUndefined();
  expect(form.get<HTMLTextAreaElement>('textarea').element.value).toBe('Replaced the damaged pipe.');
});
it('offers operator urgency controls but does not expose technician-only actions', async () => {
  useAuthStore().user!.role = 'admin'; useAuthStore().user!.siteId = 7;
  vi.mocked(api.overrideReportUrgency).mockResolvedValue(report({ finalUrgency: 'critical' }));
  await render();
  expect(wrapper.text()).toContain('Override final urgency');
  expect(wrapper.text()).not.toContain('Link another report');
  expect(wrapper.text()).not.toContain('Start work');
  const form = wrapper.findAll('form').find(form => form.text().includes('Save urgency override'))!;
  await form.get('select').setValue('critical'); await form.get('textarea').setValue('Flooding across corridor'); await form.trigger('submit'); await flushPromises();
  expect(api.overrideReportUrgency).toHaveBeenCalledWith(1, 'critical', 'Flooding across corridor');
});
it('uses a returned resolution ID when an attached reporter rates a confirmed repair', async () => {
  useAuthStore().user!.role = 'reporter';
  vi.mocked(api.listWorkflowResolutions).mockResolvedValue([{ id: 17, technicianId: 9, description: 'Repaired', createdAt: '2026-11-04T00:00:00Z' }]);
  await render(report({ status: 'confirmed', createdByUserId: 54 }));
  const form = wrapper.findAll('form').find(form => form.text().includes('Submit rating'))!;
  await form.findAll('select')[0]!.setValue('17'); await form.findAll('select')[1]!.setValue('4'); await form.get('textarea').setValue('Working well');
  await form.trigger('submit'); await flushPromises();
  expect(api.rateReportResolution).toHaveBeenCalledWith(1, 17, 4, 'Working well');
  expect(wrapper.text()).not.toContain('Override final urgency');
});
it('does not present a failed history read as empty and preserves server-masked notes', async () => {
  vi.mocked(api.listWorkflowHistory).mockRejectedValue(new Error('History unavailable'));
  await render(); expect(wrapper.text()).toContain('History unavailable'); expect(wrapper.text()).not.toContain('No history available.');
  vi.mocked(api.listWorkflowHistory).mockResolvedValue([{ id: 1, fromStatus: null, toStatus: 'open', changedByUserId: null, note: null, createdAt: '2026-11-04T00:00:00Z' }]);
  await wrapper.findAll('button').find(button => button.text() === 'Retry')!.trigger('click'); await flushPromises();
  expect(wrapper.text()).not.toContain('History unavailable'); expect(wrapper.find('ol li').exists()).toBe(true);
});
it('discards an old private history response after changing report scope', async () => {
  let finish!: (value: api.WorkflowHistory[]) => void;
  vi.mocked(api.listWorkflowHistory).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  wrapper = mount(ReportWorkflowPanel, { props: { report: report() } }); await flushPromises();
  await wrapper.setProps({ report: report({ id: 2 }) }); await flushPromises();
  finish([{ id: 10, fromStatus: null, toStatus: 'open', changedByUserId: 54, note: 'Private old report note', createdAt: '' }]); await flushPromises();
  expect(wrapper.text()).not.toContain('Private old report note');
});
