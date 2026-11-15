// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import TechnicianView from '../src/views/app/TechnicianView.vue';
import { useAuthStore } from '../src/stores/auth';
import { setLocale } from '../src/i18n';
import { report } from './fixtures';
import * as maintenance from '../src/services/maintenance';
import * as offers from '../src/services/jobOffers';

vi.mock('../src/services/maintenance', async (original) => ({
  ...(await original<typeof import('../src/services/maintenance')>()),
  listMyAssignedReports: vi.fn(),
}));
vi.mock('../src/services/jobOffers', () => ({
  listMyJobOffers: vi.fn(),
  acceptJobOffer: vi.fn(),
  rejectJobOffer: vi.fn(),
  counterJobOffer: vi.fn(),
}));

beforeEach(() => {
  setActivePinia(createPinia());
  setLocale('en');
  useAuthStore().user = {
    id: 4, role: 'technician', siteId: null, firstName: 'Test', lastName: 'Technician',
    email: 'tech@example.invalid', phone: null, address: null,
  };
  vi.mocked(maintenance.listMyAssignedReports).mockResolvedValue([report({ id: 9, assignedTechnicianId: 4 })]);
  vi.mocked(offers.listMyJobOffers).mockResolvedValue([]);
});

it('loads assigned reports for technicians without an account site', async () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: ['/technician', '/reports', '/reports/:id', '/profile', '/contracts', '/marketplace']
      .map(path => ({ path, component: { template: '<div />' } })),
  });
  await router.push('/technician');
  const wrapper = mount(TechnicianView, {
    global: {
      plugins: [router],
      stubs: {
        TechnicianTermsPanel: true,
        TechnicianAvailabilityPanel: true,
        TechnicianVerificationPanel: true,
      },
    },
  });
  await flushPromises();
  expect(maintenance.listMyAssignedReports).toHaveBeenCalled();
  expect(wrapper.text()).toContain('1 reports are assigned to you');
  expect(wrapper.get('a[href="/reports/9"]').text()).toContain('Report #9');
  expect(wrapper.get('a[href="/marketplace"]').text()).toBe('Open job marketplace');
  expect(wrapper.find('a[href="/assignments"]').exists()).toBe(false);
  wrapper.unmount();
});

it('explains empty assigned work and still shows the paid offers panel', async () => {
  vi.mocked(maintenance.listMyAssignedReports).mockResolvedValue([]);
  const router = createRouter({
    history: createMemoryHistory(),
    routes: ['/technician', '/reports', '/profile', '/contracts', '/marketplace']
      .map(path => ({ path, component: { template: '<div />' } })),
  });
  await router.push('/technician');
  const wrapper = mount(TechnicianView, {
    global: {
      plugins: [router],
      stubs: {
        TechnicianTermsPanel: true,
        TechnicianAvailabilityPanel: true,
        TechnicianVerificationPanel: true,
      },
    },
  });
  await flushPromises();
  expect(wrapper.text()).toContain('No assigned reports yet');
  expect(wrapper.text()).toContain('Paid job offers');
  wrapper.unmount();
});
