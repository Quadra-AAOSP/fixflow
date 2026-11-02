<script setup lang="ts">
import { useLocale } from '@/i18n';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { ArrowLeft, RefreshCw } from '@lucide/vue';
import { useAuth } from '@/composables/useAuth';
import { useMaintenanceStore } from '@/stores/maintenance';
import { useRealtimeStore } from '@/stores/realtime';
import * as api from '@/services/maintenance';
import { ApiError, errorMessage } from '@/services/api';
import { formatDate, humanize, statusLabels, statusTone, urgencyLabels } from '@/utils/maintenance';
import type { Report, ReportReporter } from '@/types/maintenance';
import ReportPhotosPanel from '@/components/ReportPhotosPanel.vue';
import TechnicianAssignmentPanel from '@/components/technician/TechnicianAssignmentPanel.vue';
import TechnicianInvitationSender from '@/components/technician/TechnicianInvitationSender.vue';
import ReportReviewPanel from '@/components/ReportReviewPanel.vue';
import ReportClassificationPanel from '@/components/ReportClassificationPanel.vue';
import ReportVisionPanel from '@/components/ReportVisionPanel.vue';
const { t } = useLocale();

const route = useRoute();
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
const assignmentBusy = ref(false);
const invitationBusy = ref(false);
const reviewBusy = ref(false);
const classificationBusy = ref(false);
const visionBusy = ref(false);
const actionInProgress = computed(() => busy.value || assignmentBusy.value || invitationBusy.value || reviewBusy.value || classificationBusy.value || visionBusy.value);
let generation = 0;
onBeforeUnmount(() => { generation++; realtime.setReport(null); });
watch(report, value => realtime.setReport(value));
watch(() => realtime.accessRevision, () => {
  generation++; report.value = null; reporters.value = []; reportersLoaded.value = false;
  reportersError.value = ''; actionError.value = ''; message.value = '';
  loading.value = false; error.value = 'Report access is being rechecked. Reload if the connection remains unavailable.';
});
watch(() => realtime.refreshRevision, () => {
  if (realtime.changedReportIds === null || realtime.changedReportIds.includes(Number(route.params.id))) void load();
});
const joined = computed(() => reporters.value.some(item => item.userId === user.value?.id));
async function loadReporters(id: number, version: number) {
  try {
    const result = await api.listReporters(id);
    if (version !== generation) return;
    reporters.value = result; reportersLoaded.value = true;
  } catch (err) {
    if (version !== generation) return;
    if (!(err instanceof ApiError && err.status === 403)) reportersError.value = errorMessage(err);
  }
}
async function load() {
  const version = ++generation;
  report.value = null; reporters.value = []; reportersLoaded.value = false; reportersError.value = '';
  error.value = ''; actionError.value = ''; message.value = ''; loading.value = true;
  const id = Number(route.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) { error.value = 'Invalid report ID.'; loading.value = false; return; }
  try {
    const result = await api.getReport(id);
    if (version !== generation) return;
    report.value = result; data.upsert(result);
    await loadReporters(id, version);
  } catch (err) { if (version === generation) error.value = errorMessage(err); }
  finally { if (version === generation) loading.value = false; }
}
watch(() => route.params.id, load, { immediate: true });
async function join() {
  if (!report.value || busy.value) return;
  const id = report.value.id;
  const version = generation;
  busy.value = true; actionError.value = ''; message.value = '';
  try {
    const result = await api.joinReport(id);
    if (version !== generation) return;
    report.value = result; data.upsert(result); message.value = 'You are now attached to this report.';
    await loadReporters(id, version);
  } catch (err) { if (version === generation) actionError.value = errorMessage(err); }
  finally { busy.value = false; }
}
function assigned(saved: Report) {
  report.value = saved;
  data.upsert(saved);
  message.value = 'Technician assignment saved.';
}
function reviewed(saved: Report) {
  report.value = saved; data.upsert(saved);
  message.value = saved.status === 'confirmed' ? 'The issue is confirmed as fixed.' : 'The report was reopened for further work.';
}
function classified(saved: Report) {
  report.value = saved; data.upsert(saved); message.value = 'Classification refreshed from the service.';
}
async function visionFinished(id: number) {
  const current = generation;
  const snapshot = report.value;
  if (report.value?.id !== id) return;
  try {
    const saved = await api.getReport(id);
    if (current === generation && report.value === snapshot) { report.value = saved; data.upsert(saved); }
  } catch (err) { if (current === generation && report.value === snapshot) actionError.value = errorMessage(err); }
}

</script>
<template>
  <section class="dashboard-card live-page"><div class="card-heading"><RouterLink class="text-action" to="/reports"><ArrowLeft :size="16" />{{ t("All reports") }}</RouterLink><button class="icon-button" :disabled="loading || actionInProgress" :aria-label="t('Reload report')" @click="load"><RefreshCw :size="17" /></button></div><p v-if="loading" class="live-empty" role="status">{{ t("Loading report…") }}</p><p v-else-if="error" role="alert" class="live-error">{{ t(error) }}</p>
    <template v-else-if="report"><div class="card-heading"><h1>{{ t('Report #{id}', { id: report.id }) }}</h1><span class="status-badge" :class="statusTone(report.status)">{{ t(statusLabels[report.status]) }}</span></div><p class="report-description">{{ report.description }}</p>
      <dl class="report-detail-grid"><div><dt>{{ t("Site") }}</dt><dd>{{ data.siteName(report.siteId) }}</dd></div><div><dt>{{ t("Location") }}</dt><dd>{{ report.address || t('Not shared or not provided') }}</dd></div><div><dt>{{ t("Category") }}</dt><dd>{{ t(humanize(report.category)) }}</dd></div><div><dt>{{ t("Specialty") }}</dt><dd>{{ report.specialty ? t(humanize(report.specialty)) : t('Not specified') }}</dd></div><div><dt>{{ t("Reported by") }}</dt><dd>{{ report.createdByName || t('Not shared') }}</dd></div><div><dt>{{ t("Technician") }}</dt><dd>{{ report.assignedTechnicianId == null ? t('Unassigned') : t('Technician #{id}', { id: report.assignedTechnicianId }) }}</dd></div><div><dt>{{ t("Reporter urgency") }}</dt><dd>{{ t(urgencyLabels[report.reporterUrgency]) }}</dd></div><div><dt>{{ t("AI urgency") }}</dt><dd>{{ report.aiUrgency ? t(urgencyLabels[report.aiUrgency]) : t('Not classified') }}</dd></div><div><dt>{{ t("Final urgency") }}</dt><dd>{{ report.finalUrgency ? t(urgencyLabels[report.finalUrgency]) : t('Not determined') }}</dd></div><div><dt>{{ t("Urgency reason") }}</dt><dd>{{ report.reporterReason || t('Not shared or not provided') }}</dd></div><div><dt>{{ t("Created") }}</dt><dd>{{ formatDate(report.createdAt, true) }}</dd></div><div><dt>{{ t("Updated") }}</dt><dd>{{ formatDate(report.updatedAt, true) }}</dd></div><div><dt>{{ t("Times reopened") }}</dt><dd>{{ report.reopenCount }}</dd></div></dl>
      <p v-if="message" class="draft-notice" role="status">{{ t(message) }}</p><p v-if="actionError" class="live-error" role="alert">{{ t(actionError) }}</p>
      <section class="detail-section"><h2>{{ t("People attached to this report") }}</h2><p v-if="reportersError" class="live-error">{{ t(reportersError) }}</p><ul v-else-if="reportersLoaded" class="reporter-list"><li v-for="person in reporters" :key="person.userId">{{ person.userId === user?.id ? t('You') : t('User #{id}', { id: person.userId }) }}<span>{{ t('Joined {date}', { date: formatDate(person.joinedAt, true) }) }}</span></li></ul><p v-else class="dialog-intro">{{ t("Reporter identities are only available to people with access to this report.") }}</p><button v-if="user?.role === 'reporter' && !joined" class="report-issue-button" :disabled="actionInProgress" @click="join">{{ t(busy ? 'Saving…' : 'This issue affects me too') }}</button><p v-if="user?.role === 'reporter' && !joined" class="dialog-intro">{{ t("Joining attaches your account to the report and gives you access to its shared details.") }}</p></section>
      <div v-if="report.confirmedAt || report.reopenReason" class="detail-section"><p v-if="report.confirmedAt">{{ report.confirmedByName ? t('Confirmed {date} by {name}', { date: formatDate(report.confirmedAt, true), name: report.confirmedByName }) : t('Confirmed {date}', { date: formatDate(report.confirmedAt, true) }) }}</p><p v-if="report.reopenReason">{{ t('Reopen reason: {reason}', { reason: report.reopenReason }) }}</p></div>
      <ReportClassificationPanel :report="report" :disabled="actionInProgress" @busy="classificationBusy = $event" @saved="classified" />
      <ReportVisionPanel :report="report" :disabled="actionInProgress" @busy="visionBusy = $event" @finished="visionFinished" />
      <ReportReviewPanel :report="report" :disabled="actionInProgress" @busy="reviewBusy = $event" @saved="reviewed" />
      <TechnicianAssignmentPanel :report="report" :disabled="actionInProgress" @busy="assignmentBusy = $event" @saved="assigned" />
      <TechnicianInvitationSender :report="report" :disabled="actionInProgress" @busy="invitationBusy = $event" />
      <ReportPhotosPanel :report="report" />
    </template>
  </section>
</template>
