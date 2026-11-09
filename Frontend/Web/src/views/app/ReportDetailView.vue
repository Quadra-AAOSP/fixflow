<script setup lang="ts">
import LoadingStatus from '@/components/ui/LoadingStatus.vue';
import { useLocale } from '@/i18n';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, RefreshCw } from '@lucide/vue';
import { useAuth } from '@/composables/useAuth';
import { useMaintenanceStore } from '@/stores/maintenance';
import { useRealtimeStore } from '@/stores/realtime';
import * as api from '@/services/maintenance';
import { ApiError, errorMessage } from '@/services/api';
import { formatDate, humanize, statusLabels, statusTone, urgencyLabels } from '@/utils/maintenance';
import type { Report, ReportReporter } from '@/types/maintenance';
import type { Urgency } from '@/types';
import ReportAssistantPanel from '@/components/ReportAssistantPanel.vue';
import ReportPhotosPanel from '@/components/ReportPhotosPanel.vue';
import TechnicianAssignmentPanel from '@/components/technician/TechnicianAssignmentPanel.vue';
import TechnicianInvitationSender from '@/components/technician/TechnicianInvitationSender.vue';
import MarketplacePublishPanel from '@/components/technician/MarketplacePublishPanel.vue';
import ReportWorkPanel from '@/components/ReportWorkPanel.vue';
import ReportReviewPanel from '@/components/ReportReviewPanel.vue';
import ReportWorkflowPanel from '@/components/ReportWorkflowPanel.vue';
import ReportClassificationPanel from '@/components/ReportClassificationPanel.vue';
import ReportVisionPanel from '@/components/ReportVisionPanel.vue';
const { t } = useLocale();

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
const invitationBusy = ref(false);
const reviewBusy = ref(false);
const workflowBusy = ref(false);
const classificationBusy = ref(false);
const visionBusy = ref(false);
const marketplaceBusy = ref(false);
const workBusy = ref(false);
const resolutionDraft = ref('');
const actionInProgress = computed(() => busy.value || workflowBusy.value || assignmentBusy.value || invitationBusy.value || reviewBusy.value || classificationBusy.value || visionBusy.value || marketplaceBusy.value || workBusy.value);
type TechnicianRoute = 'contracted' | 'invite' | 'marketplace';
const technicianRoute = ref<TechnicianRoute>('contracted');
const technicianRoutes = computed(() => {
  if (!report.value || ['confirmed', 'resolved_pending_confirmation'].includes(report.value.status)) return [];
  const role = user.value?.role;
  const manager = role === 'admin' || role === 'super_admin';
  const choices: TechnicianRoute[] = [];
  if (report.value.policy?.canAssign ?? (manager || role === 'staff')) choices.push('contracted');
  if (manager) choices.push('invite');
  if (role === 'admin' && user.value?.siteId === report.value.siteId &&
      report.value.assignedTechnicianId === null && ['open', 'routed', 'reopened', 'escalated'].includes(report.value.status)) {
    choices.push('marketplace');
  }
  return choices;
});
watch([technicianRoutes, () => report.value?.id], ([choices]) => {
  if (!choices.includes(technicianRoute.value)) technicianRoute.value = choices[0] ?? 'contracted';
}, { immediate: true });
let generation = 0;
onBeforeUnmount(() => { generation++; realtime.setReport(null); });
watch(report, value => realtime.setReport(value));
watch(() => realtime.accessRevision, () => {
  if (realtime.accessReason !== 'disconnect') resolutionDraft.value = '';
  generation++; report.value = null; reporters.value = []; reportersLoaded.value = false;
  reportersError.value = ''; actionError.value = ''; message.value = '';
  loading.value = false; error.value = 'Report access is being rechecked. Reload if the connection remains unavailable.';
}, { flush: 'sync' });
watch(() => realtime.refreshRevision, () => {
  if (realtime.changedReportIds === null || realtime.changedReportIds.includes(Number(route.params.id))) void load(true);
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
async function load(background = false) {
  const version = ++generation;
  const id = Number(route.params.id);
  background = background && report.value?.id === id;
  const snapshot = report.value;
  if (!background) {
    report.value = null; reporters.value = []; reportersLoaded.value = false; reportersError.value = '';
    error.value = ''; actionError.value = ''; message.value = ''; loading.value = true;
    edit.value = null; confirmingArchive.value = false;
  }
  if (!Number.isSafeInteger(id) || id <= 0) { error.value = 'Invalid report ID.'; loading.value = false; return; }
  try {
    const result = await api.getReport(id);
    if (version !== generation) return;
    if (background && report.value !== snapshot) return;
    report.value = result; data.upsert(result);
    await loadReporters(id, version);
  } catch (err) {
    if (version !== generation) return;
    if (!background || (err instanceof ApiError && (err.status === 401 || err.status === 403 || err.status === 404))) {
      resolutionDraft.value = '';
      report.value = null; reporters.value = []; reportersLoaded.value = false; error.value = errorMessage(err);
    }
  }
  finally { if (version === generation) loading.value = false; }
}
watch([() => route.params.id, () => user.value?.id, () => user.value?.role], () => { resolutionDraft.value = ''; void load(); }, { immediate: true });
function beginEdit() {
  if (!report.value) return;
  const { description, address, reporterUrgency, reporterReason } = report.value;
  edit.value = { description, address, reporterUrgency, reporterReason };
  confirmingArchive.value = false;
}
async function saveEdit() {
  if (!report.value || !edit.value || busy.value) return;
  const version = generation;
  busy.value = true; actionError.value = ''; message.value = '';
  try {
    const saved = await api.updateReport(report.value.id, edit.value);
    if (generation !== version) return;
    report.value = saved; data.upsert(saved); edit.value = null; message.value = 'Report updated.';
  } catch (err) { if (generation === version) actionError.value = errorMessage(err); }
  finally { busy.value = false; }
}
async function archiveReport() {
  if (!report.value || busy.value) return;
  const version = generation;
  busy.value = true; actionError.value = '';
  try {
    await api.deleteReport(report.value.id);
    if (generation !== version) return;
    await router.replace('/reports');
    void data.refresh();
  } catch (err) { if (generation === version) actionError.value = errorMessage(err); }
  finally { busy.value = false; }
}
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
function workflowSaved(saved: Report) {
  report.value = saved; data.upsert(saved); message.value = 'Repair workflow updated by the service.';
}
function assigned(saved: Report) {
  report.value = saved;
  data.upsert(saved);
  message.value = 'Technician assignment saved.';
}
function workSaved(saved: Report) {
  report.value = saved;
  data.upsert(saved);
  message.value = 'Work status updated.';
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
  <section class="dashboard-card live-page"><div class="card-heading"><RouterLink class="text-action" to="/reports"><ArrowLeft :size="16" />{{ t("All reports") }}</RouterLink><button class="icon-button" :disabled="loading || actionInProgress" :aria-label="t('Reload report')" @click="load()"><RefreshCw :size="17" /></button></div><LoadingStatus v-if="loading" :label="t('Loading report…')" /><p v-else-if="error" role="alert" class="live-error">{{ t(error) }}</p>
    <template v-else-if="report"><div class="card-heading"><h1>{{ t('Report #{id}', { id: report.id }) }}</h1><span class="status-badge" :class="statusTone(report.status)">{{ t(statusLabels[report.status]) }}</span></div><p class="report-description">{{ report.description }}</p>
      <dl class="report-detail-grid"><div v-if="report.visibility"><dt>{{ t('Report visibility') }}</dt><dd>{{ t(report.visibility === 'private' ? 'Private report' : 'Public within your site') }}</dd></div><div><dt>{{ t("Site") }}</dt><dd>{{ data.siteName(report.siteId) }}</dd></div><div><dt>{{ t("Location") }}</dt><dd>{{ report.address || t('Not shared or not provided') }}</dd></div><div><dt>{{ t("Category") }}</dt><dd>{{ t(humanize(report.category)) }}</dd></div><div><dt>{{ t("Specialty") }}</dt><dd>{{ report.specialty ? t(humanize(report.specialty)) : t('Not specified') }}</dd></div><div><dt>{{ t("Reported by") }}</dt><dd>{{ report.createdByName || t('Not shared') }}</dd></div><div><dt>{{ t("Technician") }}</dt><dd>{{ report.assignedTechnicianId == null ? t('Unassigned') : t('Technician #{id}', { id: report.assignedTechnicianId }) }}</dd></div><div><dt>{{ t("Reporter urgency") }}</dt><dd>{{ t(urgencyLabels[report.reporterUrgency]) }}</dd></div><div><dt>{{ t("AI urgency") }}</dt><dd>{{ report.aiUrgency ? t(urgencyLabels[report.aiUrgency]) : t('Not classified') }}</dd></div><div><dt>{{ t("Final urgency") }}</dt><dd>{{ report.finalUrgency ? t(urgencyLabels[report.finalUrgency]) : t('Not determined') }}</dd></div><div><dt>{{ t("Urgency reason") }}</dt><dd>{{ report.reporterReason || t('Not shared or not provided') }}</dd></div><div><dt>{{ t("Created") }}</dt><dd>{{ formatDate(report.createdAt, true) }}</dd></div><div><dt>{{ t("Updated") }}</dt><dd>{{ formatDate(report.updatedAt, true) }}</dd></div><div><dt>{{ t("Times reopened") }}</dt><dd>{{ report.reopenCount }}</dd></div></dl>
      <p v-if="message" class="draft-notice" role="status">{{ t(message) }}</p><p v-if="actionError" class="live-error" role="alert">{{ t(actionError) }}</p>
      <section v-if="report.policy?.canEdit || report.policy?.canDelete" class="detail-section">
        <div class="card-heading">
          <button v-if="report.policy?.canEdit && !edit" class="text-action" :disabled="actionInProgress" @click="beginEdit">{{ t('Edit report') }}</button>
          <button v-if="report.policy?.canDelete && !confirmingArchive" class="text-action" :disabled="actionInProgress" @click="edit = null; confirmingArchive = true">{{ t('Delete report') }}</button>
        </div>
        <form v-if="edit" class="draft-form" @submit.prevent="saveEdit">
          <fieldset class="report-fields" :disabled="actionInProgress">
            <label>{{ t('Description') }}<textarea v-model="edit.description" required maxlength="10000" rows="4" /></label>
            <label>{{ t('Address') }}<input v-model="edit.address" maxlength="512" /></label>
            <label>{{ t('Reporter urgency') }}<select v-model="edit.reporterUrgency"><option v-for="(label, value) in urgencyLabels" :key="value" :value="value as Urgency">{{ t(label) }}</option></select></label>
            <label>{{ t('Urgency reason') }}<textarea v-model="edit.reporterReason" maxlength="2000" rows="3" /></label>
            <button class="report-issue-button" type="submit">{{ t('Save changes') }}</button>
            <button class="text-action" type="button" @click="edit = null">{{ t('Cancel') }}</button>
          </fieldset>
        </form>
        <div v-if="confirmingArchive">
          <p class="dialog-intro">{{ t('This will archive the report and notify the people involved.') }}</p>
          <button class="report-issue-button" type="button" :disabled="actionInProgress" @click="archiveReport">{{ t('Confirm deletion') }}</button>
          <button class="text-action" type="button" :disabled="actionInProgress" @click="confirmingArchive = false">{{ t('Cancel') }}</button>
        </div>
      </section>
      <section class="detail-section"><h2>{{ t("People attached to this report") }}</h2><p v-if="reportersError" class="live-error">{{ t(reportersError) }}</p><ul v-else-if="reportersLoaded" class="reporter-list"><li v-for="person in reporters" :key="person.userId">{{ person.userId === user?.id ? t('You') : (person.name || t('User #{id}', { id: person.userId })) }}<span>{{ t('Joined {date}', { date: formatDate(person.joinedAt, true) }) }}</span></li></ul><p v-else class="dialog-intro">{{ t("Reporter identities are only available to people with access to this report.") }}</p><button v-if="user?.role === 'reporter' && !joined" class="report-issue-button" :disabled="actionInProgress" @click="join">{{ t(busy ? 'Saving…' : 'This issue affects me too') }}</button><p v-if="user?.role === 'reporter' && !joined" class="dialog-intro">{{ t("Joining attaches your account to the report and gives you access to its shared details.") }}</p></section>
      <div v-if="report.confirmedAt || report.reopenReason" class="detail-section"><p v-if="report.confirmedAt">{{ report.confirmedByName ? t('Confirmed {date} by {name}', { date: formatDate(report.confirmedAt, true), name: report.confirmedByName }) : t('Confirmed {date}', { date: formatDate(report.confirmedAt, true) }) }}</p><p v-if="report.reopenReason">{{ t('Reopen reason: {reason}', { reason: report.reopenReason }) }}</p></div>
      <ReportClassificationPanel :report="report" :disabled="actionInProgress" @busy="classificationBusy = $event" @saved="classified" />
      <ReportVisionPanel :report="report" :disabled="actionInProgress" @busy="visionBusy = $event" @finished="visionFinished" />
      <ReportWorkflowPanel supplementary :report="report" :disabled="actionInProgress" @busy="workflowBusy = $event" @saved="workflowSaved" />
      <ReportReviewPanel :report="report" :disabled="actionInProgress" @busy="reviewBusy = $event" @saved="reviewed" />
      <ReportWorkPanel v-model:description="resolutionDraft" :report="report" :disabled="actionInProgress" @busy="workBusy = $event" @saved="workSaved" />
      <section v-if="technicianRoutes.length" class="detail-section">
        <h2>{{ t('Find a technician') }}</h2>
        <label class="ranking-route">{{ t('Technician route') }}
          <select v-model="technicianRoute" :disabled="actionInProgress">
            <option v-if="technicianRoutes.includes('contracted')" value="contracted">{{ t('Assign a contracted technician') }}</option>
            <option v-if="technicianRoutes.includes('invite')" value="invite">{{ t('Invite technicians to request a site contract') }}</option>
            <option v-if="technicianRoutes.includes('marketplace')" value="marketplace">{{ t('Publish to the job marketplace') }}</option>
          </select>
        </label>
        <p class="dialog-intro">{{ t(technicianRoute === 'contracted' ? 'Choose a technician already contracted to this site.' : technicianRoute === 'invite' ? 'Invite matching technicians to request a site contract. Approval is required before assignment.' : 'Publish a job so eligible independent technicians can apply for this report.') }}</p>
        <TechnicianAssignmentPanel v-show="technicianRoute === 'contracted'" :report="report" :disabled="actionInProgress" @busy="assignmentBusy = $event" @saved="assigned" />
        <TechnicianInvitationSender v-show="technicianRoute === 'invite'" :report="report" :disabled="actionInProgress" @busy="invitationBusy = $event" />
        <MarketplacePublishPanel v-show="technicianRoute === 'marketplace'" :report="report" :disabled="actionInProgress" @busy="marketplaceBusy = $event" />
      </section>
      <ReportPhotosPanel :report="report" />
      <ReportAssistantPanel :report="report" />
    </template>
  </section>
</template>

<style scoped>
.ranking-route { display: grid; gap: .5rem; max-width: 32rem; margin-top: 1rem; }
.ranking-route select { color: var(--navy); background: #fff; width: 100%; border: 1px solid #dfe8e2; border-radius: 8px; padding: .75rem; }
</style>
