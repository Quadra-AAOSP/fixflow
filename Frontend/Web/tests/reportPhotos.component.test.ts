// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import ReportPhotosPanel from '../src/components/ReportPhotosPanel.vue';
import { useAuthStore } from '../src/stores/auth';
import * as api from '../src/services/reportPhotos';
import { report } from './fixtures';
import type { ReportPhoto } from '../src/types/maintenance';

vi.mock('../src/services/reportPhotos', async importOriginal => ({
  ...await importOriginal<typeof api>(), listReportPhotos: vi.fn(), uploadReportPhoto: vi.fn(),
  removeReportPhoto: vi.fn(), refreshReportPhotoUrl: vi.fn(),
}));
const photo: ReportPhoto = { id: 32, objectKey: 'hidden-storage-key', url: 'https://example.invalid/photo',
  contentType: 'image/png', fileSizeBytes: 5, sortOrder: 0, createdAt: '', retrievalPath: '/api/reports/1/photos/32' };
let wrapper: VueWrapper;
beforeEach(() => {
  setActivePinia(createPinia()); vi.resetAllMocks();
  useAuthStore().user = { id: 54, role: 'reporter', siteId: 7,
    firstName: 'Test', lastName: 'Reporter', email: 'test@example.invalid', phone: null, address: null };
  vi.mocked(api.listReportPhotos).mockResolvedValue([]);
  vi.mocked(api.uploadReportPhoto).mockResolvedValue({ ...photo });
  vi.mocked(api.removeReportPhoto).mockResolvedValue(undefined);
});
afterEach(() => wrapper?.unmount());

describe('report photo controls', () => {
  it('keeps photo controls and requests hidden for a peer who has not joined', async () => {
    wrapper = mount(ReportPhotosPanel, { props: { report: report() } }); await flushPromises();
    expect(api.listReportPhotos).not.toHaveBeenCalled();
    expect(wrapper.find('section').exists()).toBe(false);
  });
  it('uploads a selected file and shows the returned authorized photo link', async () => {
    wrapper = mount(ReportPhotosPanel, { props: { report: report({ createdByUserId: 54 }) } }); await flushPromises();
    const input = wrapper.get<HTMLInputElement>('input[type="file"]');
    const file = new File(['photo'], 'issue.png', { type: 'image/png' });
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true });
    await input.trigger('change');
    await wrapper.get('form').trigger('submit'); await flushPromises();
    expect(api.uploadReportPhoto).toHaveBeenCalledWith(1, file);
    expect(wrapper.get('a').attributes('href')).toBe(photo.url);
    expect(wrapper.text()).not.toContain(photo.objectKey);
    expect(wrapper.text()).toContain('Photo uploaded.');
  });
  it('requires confirmation before removing a photo', async () => {
    vi.mocked(api.listReportPhotos).mockResolvedValue([{ ...photo }]);
    wrapper = mount(ReportPhotosPanel, { props: { report: report({ createdByUserId: 54 }) } }); await flushPromises();
    await wrapper.findAll('button').find(button => button.text() === 'Remove photo 1')!.trigger('click');
    expect(api.removeReportPhoto).not.toHaveBeenCalled();
    await wrapper.findAll('button').find(button => button.text() === 'Confirm removal')!.trigger('click'); await flushPromises();
    expect(api.removeReportPhoto).toHaveBeenCalledWith(1, 32);
    expect(wrapper.find('li').exists()).toBe(false);
  });
});
