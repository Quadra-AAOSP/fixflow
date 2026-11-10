// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { mount, flushPromises } from '@vue/test-utils';
import App from '../src/App.vue';
import { useAuthStore } from '../src/stores/auth';
it('removes protected content and opens the landing page when the session is cleared', async () => {
  setActivePinia(createPinia());
  const auth = useAuthStore();
  auth.user = { id: 1, role: 'admin', siteId: 7, firstName: 'Test', lastName: 'Admin', email: 'test@example.invalid', phone: null, address: null };
  auth.isLoading = false;
  vi.stubGlobal('scrollTo', vi.fn());
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/profile', name: 'profile', meta: { requiresAuth: true }, component: { template: '<main id="main-content">Private profile</main>' } },
    { path: '/welcome', name: 'landing', meta: { public: true }, component: { template: '<main id="main-content">Public landing</main>' } },
  ] });
  await router.push('/profile');
  const wrapper = mount(App, { global: { plugins: [router] } });
  expect(wrapper.text()).toContain('Private profile');
  auth.clearSession(); await flushPromises();
  expect(wrapper.text()).not.toContain('Private profile');
  expect(router.currentRoute.value.name).toBe('landing');
  expect(router.currentRoute.value.query.redirect).toBe('/profile');
  wrapper.unmount(); vi.unstubAllGlobals();
});
