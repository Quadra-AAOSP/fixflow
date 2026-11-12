// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import ReportClassificationPanel from '../src/components/ReportClassificationPanel.vue';
import { useAuthStore } from '../src/stores/auth';
import { classifyReport } from '../src/services/maintenance';
import { report } from './fixtures';
import { setLocale } from '../src/i18n';

vi.mock('../src/services/maintenance', () => ({ classifyReport: vi.fn() }));
let wrapper: VueWrapper;
beforeEach(() => {
  setActivePinia(createPinia()); vi.resetAllMocks();
  useAuthStore().user = { id: 5, role: 'admin', siteId: 7,
    firstName: 'Test', lastName: 'Admin', email: 'admin@example.invalid', phone: null, address: null };
});
afterEach(() => { wrapper?.unmount(); setLocale('en'); });
describe('separate AI assessment', () => {
  it('renders returned AI fields as text without copying the original description', () => {
    wrapper = mount(ReportClassificationPanel, { props: { report: report({ description: 'Original reporter description', aiReport: {
      urgency: 'high', category: 'plumbing', specialty: null, description: '<b>AI assessment</b>', urgencyReason: 'Water may damage the room',
    } }) } });
    expect(wrapper.text()).toContain('<b>AI assessment</b>');
    expect(wrapper.find('b').exists()).toBe(false);
    expect(wrapper.text()).toContain('Water may damage the room');
    expect(wrapper.text()).not.toContain('Original reporter description');
  });
  it('leaves masked AI description and reason unavailable', () => {
    useAuthStore().user!.role = 'reporter';
    wrapper = mount(ReportClassificationPanel, { props: { report: report({ description: 'Reporter text', aiReport: {
      urgency: 'medium', category: null, specialty: null, description: null, urgencyReason: null,
    } }) } });
    expect(wrapper.text()).toContain('Restricted to site staff and administrators');
    expect(wrapper.text()).not.toContain('Reporter text');
    expect(wrapper.find('button').exists()).toBe(false);
  });
  it('runs manual classification only after an admin action and emits the saved result', async () => {
    const saved = report({ aiUrgency: 'high' });
    vi.mocked(classifyReport).mockResolvedValue(saved);
    wrapper = mount(ReportClassificationPanel, { props: { report: report() } });
    expect(classifyReport).not.toHaveBeenCalled();
    await wrapper.get('button').trigger('click'); await flushPromises();
    expect(classifyReport).toHaveBeenCalledWith(1);
    expect(wrapper.emitted('saved')?.[0]).toEqual([saved]);
  });
  it('does not expose manual classification to staff', () => {
    useAuthStore().user!.role = 'staff';
    wrapper = mount(ReportClassificationPanel, { props: { report: report() } });
    expect(wrapper.find('button').exists()).toBe(false);
  });
});

it('translates assessment labels while preserving returned AI narrative verbatim', () => {
  setLocale('zh-CN');
  wrapper = mount(ReportClassificationPanel, { props: { report: report({ aiReport: {
    urgency: 'high', category: 'plumbing', specialty: null, description: 'Not available', urgencyReason: 'Original AI reasoning',
  } }) } });
  expect(wrapper.get('h2').text()).toBe('AI 评估');
  expect(wrapper.text()).toContain('管道维修');
  expect(wrapper.text()).toContain('Not available');
  expect(wrapper.text()).toContain('Original AI reasoning');
});
