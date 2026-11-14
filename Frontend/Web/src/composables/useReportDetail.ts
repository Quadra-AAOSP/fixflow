import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuth } from '@/composables/useAuth';
import { useMaintenanceStore } from '@/stores/maintenance';
import { useRealtimeStore } from '@/stores/realtime';
import * as api from '@/services/maintenance';
import { ApiError, errorMessage } from '@/services/api';
import { getReportVisionJob } from '@/services/reportVision';
import type { Report, ReportReporter, ReportVisionJob } from '@/types/maintenance';
import type { Urgency } from '@/types';

export type TechnicianRoute = 'contracted' | 'marketplace';

/** Orchestrates report detail load, realtime, vision polling, and role-gated actions. */
export function useReportDetail() {
  const route = useRoute();
  const router = useRouter();
  const { user } = useAuth();
  const data = useMaintenanceStore();
  const realtime = useRealtimeStore();

  const report = ref<Report | null>(null);
  const reporters = ref<ReportReporter[]>([]);
  const reportersLoaded = ref(false);
  const reportersError = ref('');
  const loading = ref(false);
  const error = ref('');
  const actionError = ref('');
  const message = ref('');
  const busy = ref(false);
  const edit = ref<api.ReportEdit | null>(null);
  const confirmingArchive = ref(false);
  const assignmentBusy = ref(false);
  const reviewBusy = ref(false);
  const workflowBusy = ref(false);
  const classificationBusy = ref(false);
  const visionBusy = ref(false);
  const marketplaceBusy = ref(false);
  const workBusy = ref(false);
  const resolutionDraft = ref('');
  const overrideUrgency = ref<Urgency>('medium');
  const overrideReason = ref('');
  const technicianRoute = ref<TechnicianRoute>('contracted');

  const visionOverview = ref<ReportVisionJob | null>(null);
  const visionOverviewChecking = ref(false);
  let visionOverviewTimer: ReturnType<typeof setTimeout> | undefined;
  let generation = 0;

  const visionPending = computed(
    () =>
      !!visionOverview.value &&
      ['queued', 'processing'].includes(visionOverview.value.status),
  );

  const actionInProgress = computed(
    () =>
      busy.value ||
      workflowBusy.value ||
      assignmentBusy.value ||
      reviewBusy.value ||
      classificationBusy.value ||
      visionBusy.value ||
      marketplaceBusy.value ||
      workBusy.value,
  );

  const technicianRoutes = computed(() => {
    if (
      !report.value ||
      ['confirmed', 'resolved_pending_confirmation'].includes(report.value.status)
    ) {
      return [] as TechnicianRoute[];
    }
    const role = user.value?.role;
    const manager = role === 'admin' || role === 'super_admin';
    const choices: TechnicianRoute[] = [];
    if (report.value.policy?.canAssign ?? (manager || role === 'staff')) {
      choices.push('contracted');
    }
    if (
      (role === 'admin' || role === 'super_admin') &&
      (role === 'super_admin' || user.value?.siteId === report.value.siteId) &&
      report.value.assignedTechnicianId === null &&
      ['open', 'routed', 'reopened', 'escalated'].includes(report.value.status)
    ) {
      choices.push('marketplace');
    }
    return choices;
  });

  watch(
    [technicianRoutes, () => report.value?.id],
    ([choices]) => {
      if (!choices.includes(technicianRoute.value)) {
        technicianRoute.value = choices[0] ?? 'contracted';
      }
    },
    { immediate: true },
  );

  const joined = computed(() =>
    reporters.value.some((item) => item.userId === user.value?.id),
  );

  const canLeave = computed(
    () =>
      user.value?.role === 'reporter' &&
      joined.value &&
      user.value.id !== report.value?.createdByUserId,
  );

  const canOverrideUrgency = computed(
    () =>
      !!report.value &&
      report.value.status !== 'confirmed' &&
      (user.value?.role === 'staff' ||
        user.value?.role === 'admin' ||
        user.value?.role === 'super_admin'),
  );

  const canJoin = computed(
    () => user.value?.role === 'reporter' && !joined.value,
  );

  function stopVisionOverviewPoll() {
    if (visionOverviewTimer) clearTimeout(visionOverviewTimer);
    visionOverviewTimer = undefined;
  }

  function scheduleVisionOverviewPoll() {
    stopVisionOverviewPoll();
    if (visionPending.value) {
      visionOverviewTimer = setTimeout(() => {
        void refreshVisionOverview();
      }, 3000);
    }
  }

  async function visionFinished(id: number) {
    const current = generation;
    const snapshot = report.value;
    if (report.value?.id !== id) return;
    try {
      const saved = await api.getReport(id);
      if (current === generation && report.value === snapshot) {
        report.value = saved;
        data.upsert(saved);
      }
    } catch (err) {
      if (current === generation && report.value === snapshot) {
        actionError.value = errorMessage(err);
      }
    }
  }

  async function refreshVisionOverview() {
    const current = report.value;
    if (!current?.visionJob?.jobId && !visionOverview.value?.jobId) return;
    const jobId = visionOverview.value?.jobId ?? current!.visionJob!.jobId;
    const reportId = current?.id ?? visionOverview.value?.reportId;
    if (!reportId) return;
    visionOverviewChecking.value = true;
    try {
      const latest = await getReportVisionJob(reportId, jobId);
      if (report.value?.id === reportId) {
        visionOverview.value = latest;
        if (report.value) report.value = { ...report.value, visionJob: latest };
        if (['queued', 'processing'].includes(latest.status)) {
          scheduleVisionOverviewPoll();
        } else {
          stopVisionOverviewPoll();
          if (
            latest.status === 'completed' ||
            latest.status === 'review_required'
          ) {
            await visionFinished(reportId);
          }
        }
      }
    } catch {
      scheduleVisionOverviewPoll();
    } finally {
      visionOverviewChecking.value = false;
    }
  }

  function syncVisionOverview(job: ReportVisionJob | null | undefined) {
    visionOverview.value = job ?? null;
    if (visionPending.value) scheduleVisionOverviewPoll();
    else stopVisionOverviewPoll();
  }

  async function loadReporters(id: number, version: number) {
    try {
      const result = await api.listReporters(id);
      if (version !== generation) return;
      reporters.value = result;
      reportersLoaded.value = true;
    } catch (err) {
      if (version !== generation) return;
      if (!(err instanceof ApiError && err.status === 403)) {
        reportersError.value = errorMessage(err);
      }
    }
  }

  async function load(background = false) {
    const version = ++generation;
    const id = Number(route.params.id);
    background = background && report.value?.id === id;
    const snapshot = report.value;
    if (!background) {
      report.value = null;
      reporters.value = [];
      reportersLoaded.value = false;
      reportersError.value = '';
      error.value = '';
      actionError.value = '';
      message.value = '';
      loading.value = true;
      edit.value = null;
      confirmingArchive.value = false;
    }
    if (!Number.isSafeInteger(id) || id <= 0) {
      error.value = 'Invalid report ID.';
      loading.value = false;
      return;
    }
    try {
      const result = await api.getReport(id);
      if (version !== generation) return;
      if (background && report.value !== snapshot) return;
      report.value = result;
      data.upsert(result);
      syncVisionOverview(result.visionJob);
      await loadReporters(id, version);
    } catch (err) {
      if (version !== generation) return;
      if (
        !background ||
        (err instanceof ApiError &&
          (err.status === 401 || err.status === 403 || err.status === 404))
      ) {
        resolutionDraft.value = '';
        report.value = null;
        reporters.value = [];
        reportersLoaded.value = false;
        syncVisionOverview(null);
        error.value = errorMessage(err);
      }
    } finally {
      if (version === generation) loading.value = false;
    }
  }

  function beginEdit() {
    if (!report.value) return;
    const { description, address, reporterUrgency, reporterReason } =
      report.value;
    edit.value = { description, address, reporterUrgency, reporterReason };
    confirmingArchive.value = false;
  }

  async function saveEdit() {
    if (!report.value || !edit.value || busy.value) return;
    const version = generation;
    busy.value = true;
    actionError.value = '';
    message.value = '';
    try {
      const saved = await api.updateReport(report.value.id, edit.value);
      if (generation !== version) return;
      report.value = saved;
      data.upsert(saved);
      edit.value = null;
      message.value = 'Report updated.';
    } catch (err) {
      if (generation === version) actionError.value = errorMessage(err);
    } finally {
      busy.value = false;
    }
  }

  async function archiveReport() {
    if (!report.value || busy.value) return;
    const version = generation;
    busy.value = true;
    actionError.value = '';
    try {
      await api.deleteReport(report.value.id);
      if (generation !== version) return;
      await router.replace('/reports');
      void data.refresh();
    } catch (err) {
      if (generation === version) actionError.value = errorMessage(err);
    } finally {
      busy.value = false;
    }
  }

  async function join() {
    if (!report.value || busy.value) return;
    const id = report.value.id;
    const version = generation;
    busy.value = true;
    actionError.value = '';
    message.value = '';
    try {
      const result = await api.joinReport(id);
      if (version !== generation) return;
      report.value = result;
      data.upsert(result);
      message.value = 'You are now attached to this report.';
      await loadReporters(id, version);
    } catch (err) {
      if (version === generation) actionError.value = errorMessage(err);
    } finally {
      busy.value = false;
    }
  }

  async function leave() {
    if (!report.value || busy.value) return;
    const id = report.value.id;
    const version = generation;
    busy.value = true;
    actionError.value = '';
    message.value = '';
    try {
      const result = await api.leaveReport(id);
      if (version !== generation) return;
      report.value = result;
      data.upsert(result);
      message.value = 'You left this report.';
      await loadReporters(id, version);
    } catch (err) {
      if (version === generation) actionError.value = errorMessage(err);
    } finally {
      busy.value = false;
    }
  }

  async function saveUrgencyOverride() {
    if (!report.value || busy.value) return;
    const version = generation;
    busy.value = true;
    actionError.value = '';
    message.value = '';
    try {
      const result = await api.overrideUrgency(
        report.value.id,
        overrideUrgency.value,
        overrideReason.value,
      );
      if (version !== generation) return;
      report.value = result;
      data.upsert(result);
      overrideReason.value = '';
      message.value = 'Final urgency updated.';
    } catch (err) {
      if (version === generation) actionError.value = errorMessage(err);
    } finally {
      busy.value = false;
    }
  }

  function applySaved(saved: Report, notice: string) {
    report.value = saved;
    data.upsert(saved);
    message.value = notice;
  }

  function workflowSaved(saved: Report) {
    applySaved(saved, 'Repair workflow updated by the service.');
  }
  function assigned(saved: Report) {
    applySaved(saved, 'Technician assignment saved.');
  }
  function workSaved(saved: Report) {
    applySaved(saved, 'Work status updated.');
  }
  function reviewed(saved: Report) {
    applySaved(
      saved,
      saved.status === 'confirmed'
        ? 'The issue is confirmed as fixed.'
        : 'The report was reopened for further work.',
    );
  }
  function classified(saved: Report) {
    applySaved(
      saved,
      saved.aiReport?.failed
        ? 'AI urgency classification failed. Staff should review this report.'
        : 'Classification refreshed from the service.',
    );
  }

  onBeforeUnmount(() => {
    generation++;
    stopVisionOverviewPoll();
    realtime.setReport(null);
  });

  watch(report, (value) => realtime.setReport(value));

  watch(
    () => realtime.accessRevision,
    () => {
      if (realtime.accessReason !== 'disconnect') resolutionDraft.value = '';
      generation++;
      report.value = null;
      reporters.value = [];
      reportersLoaded.value = false;
      reportersError.value = '';
      actionError.value = '';
      message.value = '';
      loading.value = false;
      syncVisionOverview(null);
      error.value =
        'Report access is being rechecked. Reload if the connection remains unavailable.';
    },
    { flush: 'sync' },
  );

  watch(
    () => realtime.refreshRevision,
    () => {
      if (
        realtime.changedReportIds === null ||
        realtime.changedReportIds.includes(Number(route.params.id))
      ) {
        void load(true);
      }
    },
  );

  watch(
    [() => route.params.id, () => user.value?.id, () => user.value?.role],
    () => {
      resolutionDraft.value = '';
      void load();
    },
    { immediate: true },
  );

  return {
    user,
    data,
    report,
    reporters,
    reportersLoaded,
    reportersError,
    loading,
    error,
    actionError,
    message,
    busy,
    edit,
    confirmingArchive,
    assignmentBusy,
    reviewBusy,
    workflowBusy,
    classificationBusy,
    visionBusy,
    marketplaceBusy,
    workBusy,
    resolutionDraft,
    overrideUrgency,
    overrideReason,
    technicianRoute,
    technicianRoutes,
    visionOverview,
    visionOverviewChecking,
    visionPending,
    actionInProgress,
    joined,
    canLeave,
    canJoin,
    canOverrideUrgency,
    load,
    beginEdit,
    saveEdit,
    archiveReport,
    join,
    leave,
    saveUrgencyOverride,
    workflowSaved,
    assigned,
    workSaved,
    reviewed,
    classified,
    visionFinished,
    refreshVisionOverview,
    syncVisionOverview,
  };
}
