// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import ReportVisionPanel from '../src/components/ReportVisionPanel.vue';
import { useAuthStore } from '../src/stores/auth';
import * as api from '../src/services/reportVision';
import { report } from './fixtures';

vi.mock('../src/services/reportVision', async importOriginal => ({
  ...await importOriginal<typeof api>(), enqueueReportVision: vi.fn(), getReportVisionJob: vi.fn(),
}));
let wrapper: VueWrapper;
beforeEach(() => {
  setActivePinia(createPinia()); vi.resetAllMocks();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  useAuthStore().user = { id: 54, role: 'reporter', siteId: 7,
    firstName: 'Test', lastName: 'Reporter', email: 'test@example.invalid', phone: null, address: null };
  vi.mocked(api.enqueueReportVision).mockResolvedValue({ reportId: 1, jobId: 'job-1', status: 'queued', model: null });
  vi.mocked(api.getReportVisionJob).mockResolvedValue({ reportId: 1, jobId: 'job-1', status: 'completed', model: 'configured-model' });
});
afterEach(() => { wrapper?.unmount(); vi.useRealTimers(); });
async function selectImage() {
  const input = wrapper.get<HTMLInputElement>('input[type="file"]');
  const file = new File(['image'], 'issue.png', { type: 'image/png' });
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true });
  await input.trigger('change');
  return file;
}
describe('consented background image analysis', () => {
  it('requires consent, submits one image, then polls the returned job and requests a report refresh', async () => {
    wrapper = mount(ReportVisionPanel, { props: { report: report({ createdByUserId: 54 }) } });
    const file = await selectImage();
    await wrapper.get('form').trigger('submit');
    expect(api.enqueueReportVision).not.toHaveBeenCalled();
    await wrapper.get('input[type="checkbox"]').setValue(true);
    await wrapper.get('form').trigger('submit'); await flushPromises();
    expect(api.enqueueReportVision).toHaveBeenCalledWith(1, file, true);
    expect(wrapper.text()).toContain('Image analysis: queued');
    await vi.advanceTimersByTimeAsync(3000); await flushPromises();
    expect(api.getReportVisionJob).toHaveBeenCalledWith(1, 'job-1');
    expect(wrapper.text()).toContain('Image analysis: completed');
    expect(wrapper.emitted('finished')?.[0]).toEqual([1]);
    expect(vi.getTimerCount()).toBe(0);
    await wrapper.setProps({ report: report({ createdByUserId: 54, aiUrgency: 'high' }) });
    expect(wrapper.text()).toContain('Image analysis: completed');
  });
  it('stops polling when navigating to another report', async () => {
    wrapper = mount(ReportVisionPanel, { props: { report: report({ createdByUserId: 54 }) } });
    await selectImage(); await wrapper.get('input[type="checkbox"]').setValue(true);
    await wrapper.get('form').trigger('submit'); await flushPromises();
    await wrapper.setProps({ report: report({ id: 2, createdByUserId: 54 }) });
    await vi.advanceTimersByTimeAsync(9000);
    expect(api.getReportVisionJob).not.toHaveBeenCalled();
    expect(wrapper.text()).not.toContain('Image analysis: queued');
  });
  it('shows a status-check error and allows an explicit retry', async () => {
    wrapper = mount(ReportVisionPanel, { props: { report: report({ createdByUserId: 54 }) } });
    await selectImage(); await wrapper.get('input[type="checkbox"]').setValue(true);
    await wrapper.get('form').trigger('submit'); await flushPromises();
    vi.mocked(api.getReportVisionJob).mockRejectedValueOnce(new Error('Status unavailable'));
    await vi.advanceTimersByTimeAsync(3000); await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toBe('Status unavailable');
    expect(vi.getTimerCount()).toBe(0);
    await wrapper.findAll('button').find(button => button.text() === 'Check analysis status')!.trigger('click'); await flushPromises();
    expect(wrapper.emitted('finished')?.[0]).toEqual([1]);
  });
  it('does not allow a reporter who is not the creator to process an image', () => {
    wrapper = mount(ReportVisionPanel, { props: { report: report() } });
    expect(wrapper.find('form').exists()).toBe(false);
    expect(api.enqueueReportVision).not.toHaveBeenCalled();
  });
});
