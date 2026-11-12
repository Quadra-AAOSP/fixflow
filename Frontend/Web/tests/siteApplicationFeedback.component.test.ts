// @vitest-environment jsdom
import { mount, flushPromises } from '@vue/test-utils';
import { beforeEach, expect, it, vi } from 'vitest';
import SiteApplicationView from '../src/views/auth/SiteApplicationView.vue';
const state = vi.hoisted(() => ({ route: { name: 'site-application-status' }, request: vi.fn() }));
vi.mock('vue-router', () => ({ useRoute: () => state.route, RouterLink: { template: '<a><slot /></a>' } }));
vi.mock('../src/services/api', () => ({ request: state.request, errorMessage: (e: Error) => e.message }));
beforeEach(() => { vi.clearAllMocks(); state.route.name = 'site-application-status'; });
it('explains tracking and preserves the token after a failed request while preventing duplicate submits', async () => {
  let reject!: (e: Error) => void;
  state.request.mockReturnValue(new Promise((_, fail) => { reject = fail; }));
  const wrapper = mount(SiteApplicationView);
  expect(wrapper.text()).toContain('tracking token saved');
  await wrapper.get('input').setValue('private-token');
  await wrapper.get('form').trigger('submit');
  await wrapper.get('form').trigger('submit');
  expect(state.request).toHaveBeenCalledOnce();
  expect(wrapper.get('fieldset').attributes('disabled')).toBeDefined();
  expect(wrapper.get('button').text()).toBe('Checking application…');
  reject(new Error('Token unavailable'));
  await flushPromises();
  expect(wrapper.get('[role="alert"]').text()).toBe('Token unavailable');
  expect(wrapper.get('input').element.value).toBe('private-token');
  expect(wrapper.get('fieldset').attributes('disabled')).toBeUndefined();
});
it('associates visible password bounds with administrator setup', () => {
  state.route.name = 'site-admin-setup';
  const wrapper = mount(SiteApplicationView);
  const password = wrapper.get('input[autocomplete="new-password"]');
  expect(password.attributes('aria-describedby')).toBe('setup-password-hint');
  expect(wrapper.get('#setup-password-hint').text()).toContain('15 and 100');
  expect(wrapper.text()).toContain('private setup token delivered');
});

it('presents correction requests in plain language while retaining the correction action', async () => {
  state.request.mockResolvedValue({status:'information_requested',message:'Confirm the site address.',siteId:null,setupComplete:false});
  const wrapper = mount(SiteApplicationView);
  await wrapper.get('input').setValue('fixture-token');
  await wrapper.get('form').trigger('submit'); await flushPromises();
  expect(wrapper.get('h2').text()).toBe('Application: Information requested');
  expect(wrapper.text()).not.toContain('information_requested');
  expect(wrapper.text()).toContain('Confirm the site address.');
  expect(wrapper.text()).toContain('Submit requested information');
});
