// @vitest-environment jsdom
import { beforeEach, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { mount, flushPromises } from '@vue/test-utils';
import LandingView from '../src/views/public/LandingView.vue';
import { setLocale } from '../src/i18n';
import { useAuthStore } from '../src/stores/auth';

beforeEach(() => { setActivePinia(createPinia()); setLocale('en'); });

function render(query?: Record<string, string>) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', name: 'login', component: { template: '<div />' } },
      { path: '/welcome', component: LandingView },
      { path: '/:pathMatch(.*)*', component: { template: '<div />' } },
    ],
  });
  if (query) void router.push({ path: '/welcome', query });
  return mount(LandingView, { global: { plugins: [router] } });
}

it('keeps reporters, admins, and technicians on one landing page with working entry flows', () => {
  const wrapper = render();
  expect(wrapper.get('h1').text()).toBe('Little fixes. Better places.');
  expect(wrapper.get('#landing-brand-title').text()).toBe('FixFlow');
  for (const id of ['reporters', 'site-admins', 'technicians', 'how-it-works', 'roles', 'faq']) {
    expect(wrapper.find(`#${id}`).exists()).toBe(true);
  }
  expect(wrapper.find('a[href="#roles"]').exists()).toBe(true);
  expect(wrapper.find('a[href="/register"]').exists()).toBe(true);
  expect(wrapper.find('a[href="/login"]').exists()).toBe(true);
  expect(wrapper.find('a[href="/request-site"]').exists()).toBe(true);
  expect(wrapper.get('#reporters .landing-primary').attributes('href')).toBe('/register');
  expect(wrapper.get('#site-admins .landing-primary').attributes('href')).toBe('/request-site');
  expect(wrapper.get('#technicians .landing-primary').attributes('href')).toBe('/register');
  expect(wrapper.findAll('.landing-role-steps li')).toHaveLength(9);
  expect(wrapper.get('#reporters .landing-role-note').text().length).toBeGreaterThan(40);
  wrapper.unmount();
});

it('translates the public page and points an existing technician to their workspace', () => {
  setLocale('zh-CN');
  useAuthStore().user = { id: 1, role: 'technician', siteId: null, firstName: 'Test', lastName: 'User', email: 'test@example.invalid', phone: null, address: null };
  const wrapper = render();
  expect(wrapper.get('h1').text()).toBe('小小修缮，让空间更美好。');
  expect(wrapper.get('.landing-header-actions a').attributes('href')).toBe('/technician');
  wrapper.unmount();
  setLocale('en');
});

it('keeps a protected destination in the sign-in link on the landing page', async () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/welcome', component: LandingView },
      { path: '/login', name: 'login', component: { template: '<div />' } },
    ],
  });
  await router.push({ path: '/welcome', query: { redirect: '/reports/42?q=leak' } });
  const wrapper = mount(LandingView, { global: { plugins: [router] } });
  await flushPromises();
  expect(wrapper.get('[role="status"]').text()).toContain('Sign in to continue');
  const target = router.resolve(wrapper.get('.landing-signin').attributes('href')!);
  expect(target.name).toBe('login');
  expect(target.query.redirect).toBe('/reports/42?q=leak');
  wrapper.unmount();
});
