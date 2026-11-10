// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { flushPromises, mount } from '@vue/test-utils';
import ClaimReportPanel from '../src/components/technician/ClaimReportPanel.vue';
import { useAuthStore } from '../src/stores/auth';
import { claimReport } from '../src/services/reportWorkflow';
import { report } from './fixtures';
const navigation = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('vue-router', () => ({ useRouter: () => navigation }));
vi.mock('../src/services/reportWorkflow', () => ({ claimReport: vi.fn() }));
beforeEach(() => {
  setActivePinia(createPinia()); vi.resetAllMocks();
  useAuthStore().user = { id: 54, role: 'technician', siteId: null, firstName: 'Test', lastName: 'Tech', email: 'tech@example.invalid', phone: null, address: null };
});
it('opens the saved assigned report only after a successful claim response', async () => {
  vi.mocked(claimReport).mockResolvedValue(report({ id: 7, status: 'assigned', assignedTechnicianId: 54 }));
  const wrapper = mount(ClaimReportPanel);
  await wrapper.get('input').setValue('7'); await wrapper.get('form').trigger('submit'); await flushPromises();
  expect(claimReport).toHaveBeenCalledWith(7); expect(navigation.push).toHaveBeenCalledWith('/reports/7'); wrapper.unmount();
});
it('preserves a rejected report ID without presenting it as claimed', async () => {
  vi.mocked(claimReport).mockRejectedValue(new Error('Report is not claimable'));
  const wrapper = mount(ClaimReportPanel);
  await wrapper.get('input').setValue('7'); await wrapper.get('form').trigger('submit'); await flushPromises();
  expect(wrapper.get('[role="alert"]').text()).toBe('Report is not claimable');
  expect(wrapper.get<HTMLInputElement>('input').element.value).toBe('7'); expect(navigation.push).not.toHaveBeenCalled(); wrapper.unmount();
});
it('does not navigate to an old account claim after identity changes', async () => {
  let finish!: (value: ReturnType<typeof report>) => void;
  vi.mocked(claimReport).mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const wrapper = mount(ClaimReportPanel);
  await wrapper.get('input').setValue('7'); await wrapper.get('form').trigger('submit');
  useAuthStore().user!.id = 99;
  finish(report({ id: 7, status: 'assigned', assignedTechnicianId: 54 })); await flushPromises();
  expect(navigation.push).not.toHaveBeenCalled(); wrapper.unmount();
});
