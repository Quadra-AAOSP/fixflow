// @vitest-environment jsdom
import { setLocale } from '../src/i18n';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import TechnicianTermsPanel from '../src/components/TechnicianTermsPanel.vue';
import * as api from '../src/services/technician';
import { ApiError } from '../src/services/api';
import type { TechnicianTermsStatus } from '../src/types/technician';

vi.mock('../src/services/technician', () => ({ getTechnicianTerms: vi.fn(), acceptTechnicianTerms: vi.fn() }));
const status: TechnicianTermsStatus = {
  technicianId: 54, currentVersion: 'v3', documentUrl: 'https://example.invalid/terms/v3',
  enforcementRequired: true, acceptedCurrentVersion: false, acceptances: [],
};
let wrapper: VueWrapper;
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.getTechnicianTerms).mockResolvedValue({ ...status });
  vi.mocked(api.acceptTechnicianTerms).mockResolvedValue({ ...status, acceptedCurrentVersion: true });
});
afterEach(() => { wrapper?.unmount(); setLocale('en'); });

describe('technician terms interaction', () => {
  it('requires an explicit agreement and submits the version shown to the technician', async () => {
    wrapper = mount(TechnicianTermsPanel); await flushPromises();
    expect(wrapper.get('a').attributes('href')).toBe(status.documentUrl);
    await wrapper.get('form').trigger('submit');
    expect(api.acceptTechnicianTerms).not.toHaveBeenCalled();
    await wrapper.get('input[type="checkbox"]').setValue(true);
    await wrapper.get('form').trigger('submit'); await flushPromises();
    expect(api.acceptTechnicianTerms).toHaveBeenCalledWith('v3');
    expect(wrapper.text()).toContain('You have accepted this version.');
    expect(wrapper.find('form').exists()).toBe(false);
  });
  it('resets consent and displays the new version after an acceptance conflict', async () => {
    wrapper = mount(TechnicianTermsPanel); await flushPromises();
    vi.mocked(api.acceptTechnicianTerms).mockRejectedValueOnce(new ApiError(409, 'Terms version changed'));
    vi.mocked(api.getTechnicianTerms).mockResolvedValue({ ...status, currentVersion: 'v4' });
    await wrapper.get('input').setValue(true);
    await wrapper.get('form').trigger('submit'); await flushPromises();
    expect(wrapper.text()).toContain('version v4');
    expect(wrapper.get<HTMLInputElement>('input').element.checked).toBe(false);
    expect(wrapper.text()).toContain('The terms changed.');
    await wrapper.get('form').trigger('submit');
    expect(api.acceptTechnicianTerms).toHaveBeenCalledTimes(1);
  });
  it('removes acceptance controls when the terms cannot be refreshed', async () => {
    wrapper = mount(TechnicianTermsPanel); await flushPromises();
    vi.mocked(api.getTechnicianTerms).mockRejectedValueOnce(new Error('Terms unavailable'));
    await wrapper.get('button').trigger('click'); await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toBe('Terms unavailable');
    expect(wrapper.find('form').exists()).toBe(false);
    expect(wrapper.emitted('change')?.at(-1)).toEqual([null]);
  });
});

it('shows Chinese consent for the exact backend version and never accepts it automatically', async () => {
  setLocale('zh-CN'); wrapper = mount(TechnicianTermsPanel); await flushPromises();
  expect(wrapper.text()).toContain('我已阅读并同意版本 v3');
  expect(wrapper.get('a').attributes('href')).toBe(status.documentUrl);
  await wrapper.get('form').trigger('submit');
  expect(api.acceptTechnicianTerms).not.toHaveBeenCalled();
  await wrapper.get('input[type="checkbox"]').setValue(true);
  await wrapper.get('form').trigger('submit'); await flushPromises();
  expect(api.acceptTechnicianTerms).toHaveBeenCalledWith('v3');
  expect(wrapper.text()).toContain('您已接受此版本');
});
it('treats missing terms as a blocking setup problem even when an older server reports optional enforcement', async () => {
  vi.mocked(api.getTechnicianTerms).mockResolvedValue({ ...status, currentVersion: null, documentUrl: null, enforcementRequired: false });
  wrapper = mount(TechnicianTermsPanel); await flushPromises();
  expect(wrapper.get('[role="alert"]').text()).toContain('Required terms are unavailable');
  expect(wrapper.text()).not.toContain('Acceptance is not currently required');
  expect(wrapper.find('form').exists()).toBe(false);
  expect(api.acceptTechnicianTerms).not.toHaveBeenCalled();
});
