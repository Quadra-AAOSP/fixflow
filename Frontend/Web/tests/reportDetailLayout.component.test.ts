// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import ReportDetailView from '../src/views/app/ReportDetailView.vue';
import { useAuthStore } from '../src/stores/auth';
import { useRealtimeStore } from '../src/stores/realtime';
import * as api from '../src/services/maintenance';
import { setLocale } from '../src/i18n';
import { report } from './fixtures';
import type { ReportRealtimeClient } from '../src/services/reportRealtime';

const transport = vi.hoisted(() => ({
  callbacks: undefined as unknown as ConstructorParameters<typeof ReportRealtimeClient>[1],
}));

vi.mock('../src/services/reportRealtime', () => ({
  reportSocketUrl: () => 'ws://example.invalid/ws/reports',
  ReportRealtimeClient: class {
    constructor(
      _url: string,
      callbacks: ConstructorParameters<typeof ReportRealtimeClient>[1],
    ) {
      transport.callbacks = callbacks;
    }
    start() {}
    stop() {}
    setSubscriptions() {}
  },
}));

vi.mock('../src/services/maintenance', async (original) => ({
  ...(await original<typeof api>()),
  getReport: vi.fn(),
  listReporters: vi.fn(),
  listSites: vi.fn(),
}));

const actor = {
  id: 9,
  role: 'staff' as const,
  siteId: 1,
  firstName: 'Staff',
  lastName: 'User',
  email: 'staff@example.invalid',
  phone: null,
  address: null,
};

let wrapper: VueWrapper;

beforeEach(async () => {
  setActivePinia(createPinia());
  vi.resetAllMocks();
  setLocale('en');
  useAuthStore().user = { ...actor };
  vi.mocked(api.listSites).mockResolvedValue([]);
  vi.mocked(api.listReporters).mockResolvedValue([]);
  const realtime = useRealtimeStore();
  realtime.start(vi.fn());
  transport.callbacks.state('connected');
  transport.callbacks.connected();
  await flushPromises();
});

afterEach(() => {
  wrapper?.unmount();
  useRealtimeStore().stop();
  setLocale('en');
});

async function render(deferred = false) {
  let finish!: (value: ReturnType<typeof report>) => void;
  if (deferred) {
    vi.mocked(api.getReport).mockImplementationOnce(
      () => new Promise((resolve) => {
        finish = resolve;
      }),
    );
  } else {
    vi.mocked(api.getReport).mockResolvedValue(
      report({
        id: 2,
        description: 'Leaking pipe near the lobby',
        address: 'Building A',
        category: 'plumbing',
      }),
    );
  }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/reports/:id', name: 'report-detail', component: { template: '<div />' } },
      { path: '/reports', component: { template: '<div />' } },
    ],
  });
  await router.push('/reports/2');
  wrapper = mount(ReportDetailView, {
    global: {
      plugins: [router],
      stubs: {
        ReportPhotosPanel: true,
        ReportVisionPanel: true,
        ReportClassificationPanel: true,
        ReportWorkflowPanel: true,
        ReportReviewPanel: true,
        ReportWorkPanel: true,
        ReportAssistantPanel: true,
        TechnicianAssignmentPanel: true,
        MarketplacePublishPanel: true,
      },
    },
  });
  await flushPromises();
  return { finish: finish! };
}

describe('report detail layout', () => {
  it('shows a layout skeleton while the report is loading', async () => {
    const { finish } = await render(true);
    expect(wrapper.find('.rd-skeleton').exists()).toBe(true);
    expect(wrapper.text()).not.toContain('Leaking pipe near the lobby');
    finish(
      report({
        id: 2,
        description: 'Leaking pipe near the lobby',
        address: 'Building A',
        category: 'plumbing',
      }),
    );
    await flushPromises();
    expect(wrapper.find('.rd-skeleton').exists()).toBe(false);
    expect(wrapper.text()).toContain('Leaking pipe near the lobby');
  });

  it('renders the redesigned summary and even columns after load', async () => {
    await render();
    expect(wrapper.find('.rd-summary').exists()).toBe(true);
    expect(wrapper.find('.rd-chips').exists()).toBe(true);
    expect(wrapper.text()).not.toContain('Work and resolution');
    expect(wrapper.text()).toContain('Report information');
    expect(wrapper.find('.rd-columns').exists()).toBe(true);
  });
});
