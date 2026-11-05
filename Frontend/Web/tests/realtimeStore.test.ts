// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { flushPromises } from '@vue/test-utils';
import { useAuthStore } from '../src/stores/auth';
import { useMaintenanceStore } from '../src/stores/maintenance';
import { useRealtimeStore } from '../src/stores/realtime';
import type { ReportRealtimeClient, ReportEvent } from '../src/services/reportRealtime';
import * as authApi from '../src/services/auth';
import * as api from '../src/services/maintenance';
import { ApiError } from '../src/services/api';
import { report, site } from './fixtures';

const harness = vi.hoisted(() => ({
  callbacks: undefined as unknown as ConstructorParameters<typeof ReportRealtimeClient>[1],
  client: { start: vi.fn(), stop: vi.fn(), setSubscriptions: vi.fn() },
}));
vi.mock('../src/services/reportRealtime', () => ({
  reportSocketUrl: () => 'ws://example.invalid/ws/reports',
  ReportRealtimeClient: class {
    constructor(_url: string, callbacks: ConstructorParameters<typeof ReportRealtimeClient>[1]) { harness.callbacks = callbacks; }
    start = harness.client.start;
    stop = harness.client.stop;
    setSubscriptions = harness.client.setSubscriptions;
  },
}));
vi.mock('../src/services/auth', () => ({ getMe: vi.fn() }));
vi.mock('../src/services/maintenance', () => ({ listSites: vi.fn(), listReports: vi.fn(), listRules: vi.fn() }));
const user = { id: 54, role: 'admin' as const, siteId: 7,
  firstName: 'Test', lastName: 'Admin', email: 'test@example.invalid', phone: null, address: null };
const event: ReportEvent = { eventId: 'event-1', eventType: 'report.reassignment.v1', schemaVersion: 1,
  occurredAt: '2026-10-30T08:00:00Z', siteId: 7, reportId: 91, previousStatus: 'assigned', status: 'assigned' };
beforeEach(() => {
  setActivePinia(createPinia()); vi.resetAllMocks();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  useAuthStore().user = { ...user };
  vi.mocked(authApi.getMe).mockResolvedValue({ ...user });
  vi.mocked(api.listSites).mockResolvedValue([site(7)]);
  vi.mocked(api.listReports).mockResolvedValue([report({ description: 'Authorized REST data' })]);
  vi.mocked(api.listRules).mockResolvedValue([]);
});
afterEach(() => { useRealtimeStore().stop(); vi.useRealTimers(); });
async function connect() {
  const store = useRealtimeStore(); const expire = vi.fn();
  store.start(expire); harness.callbacks.state('connected'); harness.callbacks.connected(); await flushPromises();
  return { store, expire };
}
describe('realtime REST synchronization and private cache lifecycle', () => {
  it('preserves the selected site and taxonomy during a temporary disconnect', async () => {
    const { store } = await connect();
    const data = useMaintenanceStore();
    let finish!: (value: typeof user) => void;
    vi.mocked(authApi.getMe).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const previous = store.accessRevision;
    harness.callbacks.state('offline'); harness.callbacks.disconnected();
    expect(data.selectedSiteId).toBe(7);
    expect(data.sites).toHaveLength(1);
    expect(data.reports).toEqual([]);
    expect(store.accessRevision).toBe(previous + 1);
    finish(user); await flushPromises();
    expect(data.selectedSiteId).toBe(7);
  });
  it('revalidates the session before refreshing and subscribes only to readable report details', async () => {
    const { store } = await connect();
    expect(authApi.getMe).toHaveBeenCalledOnce();
    expect(store.state).toBe('connected'); expect(store.refreshRevision).toBe(1);
    store.setSite(7); store.setReport(report());
    expect(harness.client.setSubscriptions).toHaveBeenLastCalledWith(['/sites/7/events']);
    store.setReport(report({ policy: { canSeeSensitive: true, participant: true, canAssign: true, canJoin: false,
      statusGroup: 'open', effectiveUrgency: 'medium', urgent: false, inAssignmentQueue: false } }));
    expect(harness.client.setSubscriptions).toHaveBeenLastCalledWith(['/sites/7/events', '/reports/1/events']);
  });
  it('coalesces events into one REST refresh and never merges event fields into reports', async () => {
    const { store } = await connect();
    vi.mocked(api.listReports).mockClear();
    harness.callbacks.event(event); harness.callbacks.event({ ...event, eventId: 'event-2', reportId: 92 });
    await vi.advanceTimersByTimeAsync(150); await flushPromises();
    expect(api.listReports).toHaveBeenCalledOnce();
    expect(store.changedReportIds).toEqual([91, 92]);
    expect(useMaintenanceStore().reports[0]?.description).toBe('Authorized REST data');
  });
  it('clears caches immediately on reassignment revocation before the authorization check finishes', async () => {
    const { store } = await connect();
    let finish!: (value: typeof user) => void;
    vi.mocked(authApi.getMe).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const previous = store.accessRevision;
    harness.callbacks.revoked('/reports/91/events');
    expect(useMaintenanceStore().reports).toEqual([]);
    expect(store.accessRevision).toBe(previous + 1);
    expect(harness.client.setSubscriptions).toHaveBeenLastCalledWith([]);
    finish(user); await flushPromises();
    expect(store.refreshRevision).toBe(2);
  });
  it('expires the frontend session when a closed socket reveals an expired cookie', async () => {
    const { store, expire } = await connect();
    vi.mocked(authApi.getMe).mockRejectedValueOnce(new ApiError(401, 'Session expired'));
    harness.callbacks.disconnected(); await flushPromises();
    expect(expire).toHaveBeenCalledOnce(); expect(store.state).toBe('stopped');
    expect(useMaintenanceStore().reports).toEqual([]);
  });
  it('ignores old connection callbacks after logout', async () => {
    const { store } = await connect(); const callbacks = harness.callbacks;
    store.stop(); callbacks.event(event); await vi.advanceTimersByTimeAsync(500);
    expect(useMaintenanceStore().reports).toEqual([]); expect(vi.getTimerCount()).toBe(0);
  });
});
