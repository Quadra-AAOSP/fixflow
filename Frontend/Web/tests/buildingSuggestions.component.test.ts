// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { flushPromises, mount } from '@vue/test-utils';
import BuildingSuggestionsView from '../src/views/app/BuildingSuggestionsView.vue';
import { useAuthStore } from '../src/stores/auth';
import { requestSubsiteAddition } from '../src/services/maintenance';
vi.mock('../src/services/maintenance', () => ({ requestSubsiteAddition: vi.fn() }));
beforeEach(() => {
  setActivePinia(createPinia()); vi.resetAllMocks();
  useAuthStore().user = { id: 1, role: 'reporter', siteId: 7, firstName: 'Test', lastName: 'Reporter', email: 'test@example.invalid', phone: null, address: null };
});
it('keeps another submission available after receiving a pending receipt', async () => {
  vi.mocked(requestSubsiteAddition).mockResolvedValueOnce({ id: 10, siteId: 7, status: 'pending' }).mockResolvedValueOnce({ id: 11, siteId: 7, status: 'pending' });
  const wrapper = mount(BuildingSuggestionsView);
  await wrapper.get('textarea').setValue('Science Annex'); await wrapper.get('form').trigger('submit'); await flushPromises();
  expect(wrapper.text()).toContain('#10');
  expect(wrapper.text()).toContain('not your full request history');
  await wrapper.get('textarea').setValue('Library'); await wrapper.get('form').trigger('submit'); await flushPromises();
  expect(requestSubsiteAddition).toHaveBeenNthCalledWith(2, 7, 'Library');
  expect(wrapper.text()).toContain('#11'); wrapper.unmount();
});
it('shows a backend rejection without losing the suggestion or inventing a saved receipt', async () => {
  vi.mocked(requestSubsiteAddition).mockRejectedValue(new Error('A pending subsite request already exists'));
  const wrapper = mount(BuildingSuggestionsView);
  await wrapper.get('textarea').setValue('Library'); await wrapper.get('form').trigger('submit'); await flushPromises();
  expect(wrapper.get('[role="alert"]').text()).toContain('pending subsite request');
  expect(wrapper.get<HTMLTextAreaElement>('textarea').element.value).toBe('Library');
  expect(wrapper.text()).not.toContain('Submitted this visit'); wrapper.unmount();
});
