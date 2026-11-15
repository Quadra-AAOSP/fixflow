import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useAuthStore } from './auth';
import { useMaintenanceStore } from './maintenance';
import { API_BASE_URL } from '@/constants/config';
import { ApiError } from '@/services/api';
import { ReportRealtimeClient, reportSocketUrl, type RealtimeState } from '@/services/reportRealtime';
import type { Report } from '@/types/maintenance';

export const useRealtimeStore = defineStore('realtime', () => {
  const auth = useAuthStore();
  const data = useMaintenanceStore();
  const state = ref<RealtimeState>('stopped');
  const accessRevision = ref(0);
  const accessReason = ref<'disconnect' | 'revoked'>('revoked');
  const refreshRevision = ref(0);
  const changedReportIds = ref<number[] | null>(null);
  let client: ReportRealtimeClient | null = null;
  let generation = 0;
  let siteId: number | null = null;
  let reportId: number | null = null;
  let physicalConnection = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let syncFlight: Promise<void> | undefined;
  let syncTimer: ReturnType<typeof setTimeout> | undefined;
  const pendingReports = new Set<number>();
  let expire: () => void = () => {};
  const SYNC_SETTLE_MS = 800;

  function subscriptions() {
    client?.setSubscriptions([
      ...(siteId == null ? [] : [`/sites/${siteId}/events`]),
      ...(reportId == null ? [] : [`/reports/${reportId}/events`]),
    ]);
  }
  function setSite(id: number | null) {
    siteId = id != null && data.sites.some(site => site.id === id) ? id : null;
    subscriptions();
  }
  function setReport(report: Report | null) {
    reportId = auth.user && report?.policy?.canSeeSensitive ? report.id : null;
    subscriptions();
  }
  function invalidate() {
    clearTimeout(timer); timer = undefined;
    clearTimeout(syncTimer); syncTimer = undefined;
    pendingReports.clear();
    siteId = null; reportId = null; subscriptions();
    data.reset(); accessReason.value = 'revoked'; accessRevision.value++;
  }
  function scheduleSynchronize(current: number) {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      syncTimer = undefined;
      if (current === generation && client && physicalConnection) void synchronize();
    }, SYNC_SETTLE_MS);
  }
  function synchronize() {
    if (syncFlight || !client) return syncFlight;
    const current = generation;
    const access = accessRevision.value;
    const flight = (async () => {
      try {
        await auth.refreshUser();
        if (current !== generation || access !== accessRevision.value || !auth.user) return;
        await data.refresh();
        if (current !== generation || access !== accessRevision.value) return;
        state.value = physicalConnection ? 'connected' : 'offline';
        changedReportIds.value = null; refreshRevision.value++;
      } catch (err) {
        if (current !== generation) return;
        if (err instanceof ApiError && err.status === 401) { stop(); expire(); }
        else state.value = 'offline';
      }
    })().finally(() => {
      if (syncFlight !== flight) return;
      syncFlight = undefined;
      if (current === generation && access !== accessRevision.value && client) void synchronize();
    });
    syncFlight = flight;
    return flight;
  }
  async function refreshEvents(current: number) {
    timer = undefined;
    const ids = [...pendingReports]; pendingReports.clear();
    const access = accessRevision.value;
    await Promise.all(ids.map(id => data.refreshReport(id)));
    if (current !== generation || access !== accessRevision.value) return;
    changedReportIds.value = ids; refreshRevision.value++;
  }
  function start(onExpired: () => void) {
    if (client || !auth.user || auth.user.role === 'shop_manager') return;
    expire = onExpired;
    const current = ++generation;
    try {
      client = new ReportRealtimeClient(reportSocketUrl(API_BASE_URL, window.location.origin), {
        state(value) {
          if (current !== generation) return;
          physicalConnection = value === 'connected';
          state.value = value === 'connected' ? 'connecting' : value;
        },
        connected() {
          // Wait for the socket to stay up before REST sync — flaps used to
          // re-fetch the open report (and flash Repair workflow) every second.
          if (current === generation) scheduleSynchronize(current);
        },
        disconnected() {
          clearTimeout(syncTimer); syncTimer = undefined;
        },
        revoked(destination) {
          if (current !== generation) return;
          // Report detail access loss must clear private caches. A site channel
          // revoke only drops that subscription — it must not wipe the open report.
          if (destination.startsWith('/reports/')) {
            invalidate();
            void synchronize();
            return;
          }
          if (destination.startsWith('/sites/')) {
            siteId = null;
            subscriptions();
          }
        },
        event(event) {
          if (current !== generation) return;
          pendingReports.add(event.reportId);
          clearTimeout(timer);
          timer = setTimeout(() => { void refreshEvents(current); }, 150);
        },
      });
      client.start();
    } catch { state.value = 'offline'; }
  }
  function stop() {
    generation++; clearTimeout(timer); timer = undefined;
    clearTimeout(syncTimer); syncTimer = undefined;
    pendingReports.clear(); syncFlight = undefined;
    const previous = client; client = null; previous?.stop();
    siteId = null; reportId = null; physicalConnection = false;
    state.value = 'stopped'; changedReportIds.value = null;
    data.reset(); accessReason.value = 'revoked'; accessRevision.value++;
  }
  return { state, accessReason, accessRevision, refreshRevision, changedReportIds, start, stop, setSite, setReport };
});
