// @vitest-environment jsdom
import { mount, flushPromises } from '@vue/test-utils';
import { nextTick } from 'vue';
import { beforeEach, expect, it, vi } from 'vitest';
import SiteApplicationsView from '../src/views/app/SiteApplicationsView.vue';
import TechnicianVerificationReviewView from '../src/views/app/TechnicianVerificationReviewView.vue';
const api = vi.hoisted(() => ({ request: vi.fn(), list: vi.fn() }));
vi.mock('../src/services/api', () => ({ request: api.request, errorMessage: (e: Error) => e.message }));
vi.mock('../src/services/technicianVerification', () => ({ listVerifications: api.list, decideVerification: vi.fn() }));
beforeEach(() => vi.clearAllMocks());
for (const [name, component, fetcher, empty] of [
  ['site', SiteApplicationsView, api.request, 'No site applications.'],
  ['verification', TechnicianVerificationReviewView, api.list, 'No applications to review.'],
] as const) {
  it(`${name} queue distinguishes pending, failed, and recovered empty results`, async () => {
    let reject!: (error: Error) => void;
    fetcher.mockReturnValueOnce(new Promise((_, fail) => { reject = fail; }));
    const wrapper = mount(component);
    await nextTick();
    expect(wrapper.text()).toContain('Loading');
    expect(wrapper.text()).not.toContain(empty);
    reject(new Error('Service unavailable'));
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('Service unavailable');
    expect(wrapper.text()).not.toContain(empty);
    fetcher.mockResolvedValueOnce([]);
    await wrapper.findAll('button').find(button => button.text() === 'Retry')!.trigger('click');
    await flushPromises();
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(wrapper.text()).toContain(empty);
    wrapper.unmount();
  });
}
