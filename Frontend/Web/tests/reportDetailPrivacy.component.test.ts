// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import ReportDetailView from '../src/views/app/ReportDetailView.vue';
import { useAuthStore } from '../src/stores/auth';
import { useRealtimeStore } from '../src/stores/realtime';
import * as authApi from '../src/services/auth';
import * as api from '../src/services/maintenance';
import { ApiError } from '../src/services/api';
import { setLocale } from '../src/i18n';
import { report } from './fixtures';
import type { ReportRealtimeClient } from '../src/services/reportRealtime';
const transport = vi.hoisted(() => ({ callbacks: undefined as unknown as ConstructorParameters<typeof ReportRealtimeClient>[1] }));
vi.mock('../src/services/reportRealtime', () => ({
  reportSocketUrl: () => 'ws://example.invalid/ws/reports',
  ReportRealtimeClient: class {
    constructor(_url: string, callbacks: ConstructorParameters<typeof ReportRealtimeClient>[1]) { transport.callbacks = callbacks; }
    start() {} stop() {} setSubscriptions() {}
  },
}));
vi.mock('../src/services/auth', () => ({ getMe: vi.fn() }));
vi.mock('../src/services/maintenance', async original => ({ ...await original<typeof api>(), getReport: vi.fn(), listReporters: vi.fn(), listSites: vi.fn() }));
const actor = { id: 54, role: 'technician' as const, siteId: null, firstName: 'Test', lastName: 'Technician', email: 'test@example.invalid', phone: null, address: null };
const privateReport = report({ id: 2, status: 'assigned', assignedTechnicianId: 54, description: 'PRIVATE DESCRIPTION', address: 'PRIVATE ADDRESS', reporterReason: 'PRIVATE REASON', createdByName: 'PRIVATE CREATOR',
  policy: { canSeeSensitive: true, participant: false, canAssign: false, canJoin: false, statusGroup: 'progress', effectiveUrgency: 'medium', urgent: false, inAssignmentQueue: true } });
let wrapper: VueWrapper;
beforeEach(async () => {
  setActivePinia(createPinia()); vi.resetAllMocks(); setLocale('en');
  useAuthStore().user = { ...actor };
  vi.mocked(authApi.getMe).mockResolvedValue({ ...actor });
  vi.mocked(api.listSites).mockResolvedValue([]);
  vi.mocked(api.getReport).mockResolvedValue(privateReport);
  vi.mocked(api.listReporters).mockRejectedValue(new ApiError(403, 'Reporter identities unavailable'));
  const realtime = useRealtimeStore(); realtime.start(vi.fn());
  transport.callbacks.state('connected'); transport.callbacks.connected(); await flushPromises();
});
afterEach(() => { wrapper?.unmount(); useRealtimeStore().stop(); setLocale('en'); });
async function render() {
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/reports/:id', name: 'report-detail', component: { template: '<div />' } },
    { path: '/reports', component: { template: '<div />' } },
  ] });
  await router.push('/reports/2');
  wrapper = mount(ReportDetailView, { global: { plugins: [router], stubs: {
    ReportPhotosPanel: true, ReportVisionPanel: true, ReportClassificationPanel: true,
    ReportReviewPanel: true, TechnicianAssignmentPanel: true, TechnicianInvitationSender: true,
  } } });
  await flushPromises(); return router;
}
function expectNoPrivateContent() {
  for (const marker of ['PRIVATE DESCRIPTION', 'PRIVATE ADDRESS', 'PRIVATE REASON', 'PRIVATE CREATOR']) expect(wrapper.text()).not.toContain(marker);
  expect(wrapper.find('report-photos-panel-stub').exists()).toBe(false);
}
describe('private report detail revocation', () => {
  it('removes private details before the authorization refresh finishes and keeps them removed after denial', async () => {
    setLocale('zh-CN'); await render(); expect(wrapper.text()).toContain('PRIVATE ADDRESS');
    let finish!: (value: typeof actor) => void;
    vi.mocked(authApi.getMe).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    transport.callbacks.revoked('/reports/2/events'); await nextTick();
    expectNoPrivateContent();
    vi.mocked(api.getReport).mockRejectedValueOnce(new ApiError(403, 'Only the currently assigned technician may view this report'));
    finish({ ...actor }); await flushPromises();
    expectNoPrivateContent();
    expect(wrapper.get('[role="alert"]').text()).toContain('只有当前被分配的技术人员');
  });
  it('does not restore a late report response received after revocation', async () => {
    let finishReport!: (value: typeof privateReport) => void;
    let finishAccess!: (value: typeof actor) => void;
    vi.mocked(api.getReport).mockImplementationOnce(() => new Promise(resolve => { finishReport = resolve; }));
    await render();
    vi.mocked(authApi.getMe).mockImplementationOnce(() => new Promise(resolve => { finishAccess = resolve; }));
    transport.callbacks.revoked('/reports/2/events'); await nextTick();
    finishReport(privateReport); await flushPromises();
    expectNoPrivateContent();
    vi.mocked(api.getReport).mockRejectedValueOnce(new ApiError(403, 'Only the currently assigned technician may view this report'));
    finishAccess({ ...actor }); await flushPromises(); expectNoPrivateContent();
  });
  it('drops report content while a disconnected socket’s session is being rechecked', async () => {
    await render(); expect(wrapper.text()).toContain('PRIVATE DESCRIPTION');
    let finish!: (value: typeof actor) => void;
    vi.mocked(authApi.getMe).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    transport.callbacks.state('offline'); transport.callbacks.disconnected(); await nextTick();
    expectNoPrivateContent();
    vi.mocked(api.getReport).mockResolvedValueOnce(report({ id: 2, description: 'New authorized response', address: null }));
    finish({ ...actor }); await flushPromises();
    expect(wrapper.text()).toContain('New authorized response');
    expect(wrapper.text()).not.toContain('PRIVATE ADDRESS');
  });
});
