// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { flushPromises, mount } from '@vue/test-utils';
import ReportAssistantPanel from '../src/components/ReportAssistantPanel.vue';
import { useAuthStore } from '../src/stores/auth';
import { useRealtimeStore } from '../src/stores/realtime';
import { askReportAssistant } from '../src/services/reportAssistant';
import { setLocale } from '../src/i18n';
import { report } from './fixtures';
vi.mock('../src/services/reportAssistant', () => ({ askReportAssistant: vi.fn() }));
beforeEach(() => {
  setActivePinia(createPinia()); vi.resetAllMocks(); setLocale('en');
  useAuthStore().user = { id: 1, role: 'reporter', siteId: 7, firstName: 'Test', lastName: 'Reporter', email: 'test@example.invalid', phone: null, address: null };
});
function render() { return mount(ReportAssistantPanel, { props: { report: report({ id: 91, siteId: 7, createdByUserId: 1 }) } }); }
it('requires opt-in and renders provider text without executing markup', async () => {
  const wrapper = render(); await wrapper.get('textarea').setValue('What happens next?');
  await wrapper.get('form').trigger('submit'); expect(askReportAssistant).not.toHaveBeenCalled();
  await wrapper.get('input').setValue(true);
  vi.mocked(askReportAssistant).mockResolvedValue({ reply: '<script>unsafe()</script>', fallback: false });
  await wrapper.get('form').trigger('submit'); await flushPromises();
  expect(askReportAssistant).toHaveBeenCalledWith(91, [{ role: 'user', content: 'What happens next?' }]);
  expect(wrapper.find('script').exists()).toBe(false);
  expect(wrapper.text()).toContain('<script>unsafe()</script>'); wrapper.unmount();
});
it('clears chat and ignores pending replies after access invalidation', async () => {
  let finish!: (value: { reply: string; fallback: boolean }) => void;
  vi.mocked(askReportAssistant).mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const wrapper = render(); await wrapper.get('input').setValue(true); await wrapper.get('textarea').setValue('Private question');
  await wrapper.get('form').trigger('submit'); useRealtimeStore().accessRevision++; await flushPromises();
  finish({ reply: 'Private old answer', fallback: false }); await flushPromises();
  expect(wrapper.text()).not.toContain('Private old answer');
  expect(wrapper.get<HTMLTextAreaElement>('textarea').element.value).toBe('');
  expect(wrapper.get<HTMLInputElement>('input').element.checked).toBe(false); wrapper.unmount();
});
it('shows fallback feedback and retains the question for retry', async () => {
  const wrapper = render(); await wrapper.get('input').setValue(true); await wrapper.get('textarea').setValue('Help');
  vi.mocked(askReportAssistant).mockResolvedValue({ reply: null, fallback: true });
  await wrapper.get('form').trigger('submit'); await flushPromises();
  expect(wrapper.get('[role="alert"]').text()).toContain('not answered');
  expect(wrapper.findAll('li')).toHaveLength(0); wrapper.unmount();
});
it('hides controls for unrelated reporters and shop managers', async () => {
  const wrapper = render(); await wrapper.setProps({ report: report({ siteId: 7, createdByUserId: 2 }) });
  expect(wrapper.find('form').exists()).toBe(false);
  useAuthStore().user!.role = 'shop_manager'; await flushPromises();
  expect(wrapper.find('form').exists()).toBe(false); wrapper.unmount();
});
