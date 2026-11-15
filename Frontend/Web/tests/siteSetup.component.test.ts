// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils';
import { expect, it, vi } from 'vitest';
import SiteSetupView from '../src/views/app/SiteSetupView.vue';

const api = vi.hoisted(() => ({
  getSite: vi.fn(),
  getReportingSetup: vi.fn(),
  updateSite: vi.fn(),
  uploadSiteDocument: vi.fn(),
  refreshUser: vi.fn(),
  push: vi.fn(),
  user: { siteOnboarding: { siteId: 71, setupRequired: true } },
}));
vi.mock('vue-router', () => ({ useRouter: () => ({ push: api.push }) }));
vi.mock('@/composables/useAuth', () => ({ useAuth: () => ({
  user: { value: api.user }, refreshUser: api.refreshUser,
}) }));
vi.mock('@/services/siteDetails', () => api);
vi.mock('@/services/maintenance', () => api);

it('lets an inactive site with a building save its details and finish after both files upload', async () => {
  const site = { id: 71, name: 'Demo Campus', type: 'school', contractStatus: 'contracted', address: 'Demo address' };
  api.getSite.mockResolvedValue(site);
  api.getReportingSetup.mockResolvedValue({ activeSubsiteCount: 1, reportingReady: false });
  api.updateSite.mockResolvedValue(site);
  api.uploadSiteDocument
    .mockResolvedValueOnce({ ...site, termsDocumentPresent: true })
    .mockResolvedValueOnce({ ...site, termsDocumentPresent: true, contractTermsDocumentPresent: true });
  api.refreshUser.mockImplementation(() => { api.user.siteOnboarding.setupRequired = false; });
  const view = mount(SiteSetupView, { global: { stubs: ['RouterLink'] } });
  await flushPromises();
  await view.get('form').trigger('submit');
  await flushPromises();
  expect(api.updateSite).toHaveBeenCalledWith(71, expect.objectContaining({ address: 'Demo address' }));
  const finish = () => view.findAll('button').find(button => button.text() === 'Finish setup')!;
  expect(finish().attributes('disabled')).toBeDefined();
  const inputs = view.findAll('input[type=file]');
  Object.defineProperty(inputs[0].element, 'files', {
    configurable: true, value: [new File([], 'empty.txt', { type: 'text/plain' })],
  });
  await inputs[0].trigger('change');
  expect(view.get('[role=alert]').text()).toContain('This file is empty');
  expect(api.uploadSiteDocument).not.toHaveBeenCalled();
  for (const [index, kind] of ['terms', 'contract'].entries()) {
    const file = new File(['demo'], kind + '.txt', { type: 'text/plain' });
    Object.defineProperty(inputs[index].element, 'files', { configurable: true, value: [file] });
    await inputs[index].trigger('change');
    await flushPromises();
    expect(api.uploadSiteDocument).toHaveBeenCalledWith(71, kind, file);
    if (index === 0) expect(finish().attributes('disabled')).toBeDefined();
  }
  expect(finish().attributes('disabled')).toBeUndefined();
  await finish().trigger('click');
  await flushPromises();
  expect(api.refreshUser).toHaveBeenCalled();
  expect(api.push).toHaveBeenCalledWith('/');
  view.unmount();
});
