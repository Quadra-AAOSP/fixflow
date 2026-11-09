// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import ReportFormView from '../src/views/app/ReportFormView.vue';
import { useAuthStore } from '../src/stores/auth';
import { useMaintenanceStore } from '../src/stores/maintenance';
import * as api from '../src/services/maintenance';
import { report, site } from './fixtures';
import { setLocale } from '../src/i18n';

vi.mock('../src/services/maintenance', () => ({
  listSubsites: vi.fn(), createReport: vi.fn(), createReportWithPhotos: vi.fn(), requestSubsiteAddition: vi.fn(),
}));
let wrapper: VueWrapper;
beforeEach(() => {
  setActivePinia(createPinia()); vi.resetAllMocks();
  useAuthStore().user = { id: 54, role: 'reporter', siteId: 7,
    firstName: 'Test', lastName: 'Reporter', email: 'test@example.invalid', phone: null, address: null };
  const data = useMaintenanceStore();
  data.sites = [site(7)]; data.selectedSiteId = 7;
  data.rules = [{ id: 1, siteType: 'school', category: 'plumbing', urgencyWeight: 2, sortOrder: 1 }];
  vi.mocked(api.listSubsites).mockResolvedValue([{ id: 42, siteId: 7, label: 'A', name: 'Main building', description: null, archivedAt: null }]);
  vi.mocked(api.createReport).mockResolvedValue(report({ id: 91, subsiteId: 42 }));
  vi.mocked(api.createReportWithPhotos).mockResolvedValue(report({ id: 91, subsiteId: 42 }));
});
afterEach(() => { wrapper?.unmount(); setLocale('en'); });
async function mountForm() {
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/', component: { template: '<div />' } },
    { path: '/reports', name: 'reports', component: { template: '<div />' } },
    { path: '/reports/:id', name: 'report-detail', component: { template: '<div />' } },
    { path: '/sites/:siteId/subsites', name: 'subsites', component: { template: '<div />' } },
  ] });
  await router.push('/');
  wrapper = mount(ReportFormView, { global: { plugins: [router] } }); await flushPromises();
  return router;
}
async function completeFields() {
  await wrapper.get('textarea').setValue('A pipe is leaking.');
  const selects = wrapper.findAll('select');
  await selects[0]!.setValue('42');
  await selects[1]!.setValue('plumbing');
  await selects[2]!.setValue('high');
}
describe('report intake interactions', () => {
  it('preselects the only active building for the selected site', async () => {
    await mountForm();
    expect(wrapper.findAll('select')[0]!.element.value).toBe('42');
  });
  it('requires the actual building selection and navigates to the saved report', async () => {
    const router = await mountForm();
    await wrapper.findAll('form')[0]!.trigger('submit');
    expect(api.createReport).not.toHaveBeenCalled();
    await completeFields();
    await wrapper.findAll('form')[0]!.trigger('submit'); await flushPromises();
    expect(api.createReport).toHaveBeenCalledWith(expect.objectContaining({ siteId: 7, subsiteId: 42, reporterUrgency: 'high' }));
    expect(router.currentRoute.value.name).toBe('report-detail');
    expect(router.currentRoute.value.params.id).toBe('91');
  });
  it('includes selected photos in the single create request', async () => {
    await mountForm(); await completeFields();
    const input = wrapper.get<HTMLInputElement>('input[type="file"]');
    const photo = new File(['photo'], 'issue.png', { type: 'image/png' });
    Object.defineProperty(input.element, 'files', { value: [photo], configurable: true });
    await input.trigger('change');
    await wrapper.findAll('form')[0]!.trigger('submit'); await flushPromises();
    expect(api.createReportWithPhotos).toHaveBeenCalledWith(expect.objectContaining({ subsiteId: 42 }), [photo]);
    expect(api.createReport).not.toHaveBeenCalled();
  });
  it('shows site setup guidance when no labelled building is configured', async () => {
    Object.assign(useAuthStore().user!, { role: 'admin' });
    vi.mocked(api.listSubsites).mockResolvedValue([]);
    await mountForm();
    expect(wrapper.text()).toContain('Reporting is not ready');
    expect(wrapper.get('a[href="/sites/7/subsites"]').text()).toContain('Set up buildings');
    expect(wrapper.find('input[type="file"]').exists()).toBe(false);
  });
});

it('submits unchanged taxonomy codes and user text from the Chinese report form', async () => {
  setLocale('zh-CN'); await mountForm(); await completeFields();
  expect(wrapper.get('h1').text()).toBe('提交报修');
  expect(wrapper.text()).toContain('管道维修');
  await wrapper.findAll('form')[0]!.trigger('submit'); await flushPromises();
  expect(api.createReport).toHaveBeenCalledWith(expect.objectContaining({ description: 'A pipe is leaking.', category: 'plumbing', subsiteId: 42, reporterUrgency: 'high' }));
});

it('opens a focused building suggestion beside the selector without losing the report draft', async () => {
  await mountForm(); await completeFields();
  await wrapper.get('button[aria-controls="building-suggestion"]').trigger('click');
  const note = wrapper.get<HTMLTextAreaElement>('#building-suggestion-fields textarea');
  await note.setValue('Please add the new science building.');
  vi.mocked(api.requestSubsiteAddition).mockResolvedValue({ id: 8, siteId: 7, status: 'pending' });
  await wrapper.get('#building-suggestion-fields form').trigger('submit'); await flushPromises();
  expect(api.requestSubsiteAddition).toHaveBeenCalledWith(7, 'Please add the new science building.');
  expect(wrapper.get('#building-suggestion-fields').text()).toContain('sent to the site administrator');
  expect(wrapper.get<HTMLInputElement>('input[maxlength="512"]').element.value).toBe('Please add the new science building.');
  expect(wrapper.get('textarea').element.value).toBe('A pipe is leaking.');
  expect(api.createReport).not.toHaveBeenCalled();
});
it('offers a suggestion even when the site has no buildings', async () => {
  vi.mocked(api.listSubsites).mockResolvedValue([]); await mountForm();
  await wrapper.get('button[aria-controls="building-suggestion-fields"]').trigger('click');
  expect(wrapper.find('#building-suggestion-fields textarea').exists()).toBe(true);
  expect(wrapper.find('button[type="submit"].report-issue-button').exists()).toBe(false);
});
it('keeps failed building suggestions available for retry', async () => {
  await mountForm();
  await wrapper.get('button[aria-controls="building-suggestion"]').trigger('click');
  await wrapper.get('#building-suggestion-fields textarea').setValue('New annex');
  vi.mocked(api.requestSubsiteAddition).mockRejectedValue(new Error('Request failed'));
  await wrapper.get('#building-suggestion-fields form').trigger('submit'); await flushPromises();
  expect(wrapper.get('#building-suggestion-fields [role="alert"]').text()).toBe('Request failed');
  expect(wrapper.get<HTMLTextAreaElement>('#building-suggestion-fields textarea').element.value).toBe('New annex');
});
it('ignores an old suggestion after the user switches away from and back to a site', async () => {
  let finish!: (value: { id: number; siteId: number; status: string }) => void;
  vi.mocked(api.requestSubsiteAddition).mockReturnValue(new Promise(resolve => { finish = resolve; }));
  await mountForm();
  await wrapper.get('button[aria-controls="building-suggestion"]').trigger('click');
  await wrapper.get('#building-suggestion-fields textarea').setValue('Old suggestion');
  await wrapper.get('#building-suggestion-fields form').trigger('submit');
  const data = useMaintenanceStore();
  data.selectedSiteId = 8; await flushPromises();
  data.selectedSiteId = 7; await flushPromises();
  finish({ id: 8, siteId: 7, status: 'pending' }); await flushPromises();
  await wrapper.get('button[aria-controls="building-suggestion"]').trigger('click');
  expect(wrapper.get('#building-suggestion-fields').text()).not.toContain('sent to the site administrator');
});
it('submits the selected privacy and optional specialty without changing category codes', async () => {
  await mountForm(); await completeFields();
  await wrapper.get('input[maxlength="128"]').setValue('pipework');
  await wrapper.findAll('select')[3]!.setValue('private');
  await wrapper.findAll('form')[0]!.trigger('submit'); await flushPromises();
  expect(api.createReport).toHaveBeenCalledWith(expect.objectContaining({ visibility: 'private', specialty: 'pipework', category: 'plumbing' }));
});
