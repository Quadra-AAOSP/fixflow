// @vitest-environment jsdom
import { beforeEach, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { mount, flushPromises } from '@vue/test-utils';
import LandingView from '../src/views/public/LandingView.vue';
import { setLocale } from '../src/i18n';
import { useAuthStore } from '../src/stores/auth';
import type { Audience } from '../src/views/public/landingContent';
beforeEach(() => { setActivePinia(createPinia()); setLocale('en'); });
function render(audience?: Audience) {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/login', name: 'login', component: { template: '<div />' } }, { path: '/:pathMatch(.*)*', component: { template: '<div />' } }] });
  return mount(LandingView, { props: { audience }, global: { plugins: [router] } });
}
it('links the public overview to all role pages and existing entry flows', () => {
  const wrapper = render();
  expect(wrapper.get('h1').text()).toBe('Little fixes. Better places.');
  for (const path of ['/for/reporters','/for/site-admins','/for/technicians','/register','/login','/request-site']) expect(wrapper.find(`a[href="${path}"]`).exists()).toBe(true);
  expect(wrapper.text()).toContain('Illustrative example');
  wrapper.unmount();
});
it.each(['reporters','site-admins','technicians'] as Audience[])('gives %s a working next step and eligibility context', audience => {
  const wrapper = render(audience);
  expect(wrapper.findAll('h1')).toHaveLength(1);
  expect(wrapper.get('.landing-primary').attributes('href')).toBe(audience === 'site-admins' ? '/request-site' : '/register');
  expect(wrapper.findAll('.landing-steps li')).toHaveLength(3);
  expect(wrapper.get('.landing-access-note').text().length).toBeGreaterThan(40);
  wrapper.unmount();
});
it('translates the public pages and points an existing technician to their workspace', () => {
  setLocale('zh-CN');
  useAuthStore().user = { id: 1, role: 'technician', siteId: null, firstName: 'Test', lastName: 'User', email: 'test@example.invalid', phone: null, address: null };
  const wrapper = render();
  expect(wrapper.get('h1').text()).toBe('小小修缮，让空间更美好。');
  expect(wrapper.get('.landing-header-actions a').attributes('href')).toBe('/technician');
  wrapper.unmount(); setLocale('en');
});

it('keeps a protected destination in the sign-in link on the landing page', async () => {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/welcome', component: LandingView }, { path: '/login', name: 'login', component: { template: '<div />' } }] });
  await router.push({ path: '/welcome', query: { redirect: '/reports/42?q=leak' } });
  const wrapper = mount(LandingView, { global: { plugins: [router] } }); await flushPromises();
  expect(wrapper.get('[role="status"]').text()).toContain('Sign in to continue');
  const target = router.resolve(wrapper.get('.landing-signin').attributes('href')!);
  expect(target.name).toBe('login'); expect(target.query.redirect).toBe('/reports/42?q=leak');
  wrapper.unmount();
});
