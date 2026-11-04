<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useAuth } from '@/composables/useAuth';
import { useLocale } from '@/i18n';
import { errorMessage } from '@/services/api';
import { formatDate, humanize } from '@/utils/maintenance';
import * as api from '@/services/reportWorkflow';
import type { Report } from '@/types/maintenance';
import type { Urgency } from '@/types';
const props = defineProps<{ report: Report; disabled?: boolean }>();
const emit = defineEmits<{ saved: [report: Report]; busy: [value: boolean] }>();
const { user } = useAuth(); const { t } = useLocale();
const operator = computed(() => ['staff', 'admin', 'super_admin'].includes(user.value?.role ?? ''));
const assigned = computed(() => user.value?.role === 'technician' && props.report.assignedTechnicianId === user.value.id);
const canStart = computed(() => assigned.value && ['assigned', 'reopened', 'escalated'].includes(props.report.status));
const canResolve = computed(() => assigned.value && props.report.status === 'in_progress');
const canEscalate = computed(() => (operator.value || assigned.value) && !['confirmed', 'resolved_pending_confirmation', 'escalated'].includes(props.report.status));
const canRate = computed(() => props.report.status === 'confirmed' && (operator.value || user.value?.role === 'reporter' && (props.report.createdByUserId === user.value.id || props.report.policy?.participant)));
const busy = ref(false); const loading = ref(false); const error = ref(''); const message = ref('');
const description = ref(''); const escalation = ref(''); const urgencyReason = ref(''); const urgency = ref<Urgency>('medium');
const resolutionId = ref(''); const score = ref(''); const feedback = ref(''); const linkedId = ref(''); const linkReason = ref('');
const history = ref<api.WorkflowHistory[] | null>(null); const resolutions = ref<api.WorkflowResolution[] | null>(null);
const ratings = ref<api.WorkflowRating[] | null>(null); const links = ref<api.WorkflowLink[] | null>(null);
const readErrors = ref<Array<{ label: string; error: string }>>([]);
let generation = 0; onBeforeUnmount(() => generation++);
async function loadDetails() {
  const current = ++generation; const reportId = props.report.id;
  history.value = null; resolutions.value = null; ratings.value = null; links.value = null; readErrors.value = [];
  loading.value = true;
  const results = await Promise.allSettled([api.listWorkflowHistory(reportId), api.listWorkflowResolutions(reportId), api.listWorkflowRatings(reportId), api.listWorkflowLinks(reportId)]);
  if (current !== generation) return false;
  const targets = [history, resolutions, ratings, links]; const labels = ['Report history', 'Repair resolutions', 'Repair ratings', 'Linked reports'];
  results.forEach((result, index) => {
    if (result.status === 'rejected') readErrors.value.push({ label: labels[index]!, error: errorMessage(result.reason) });
    else (targets[index] as { value: unknown }).value = result.value;
  });
  loading.value = false;
  return true;
}
watch(() => [props.report.id, props.report.status, props.report.assignedTechnicianId, props.report.policy?.canSeeSensitive, props.report.policy?.participant, user.value?.id, user.value?.role], () => {
  description.value = ''; escalation.value = ''; urgencyReason.value = ''; resolutionId.value = ''; score.value = ''; feedback.value = ''; linkedId.value = ''; linkReason.value = ''; error.value = ''; message.value = '';
  urgency.value = props.report.finalUrgency ?? props.report.reporterUrgency;
  void loadDetails();
}, { immediate: true });
async function perform(action: 'start' | 'resolve' | 'escalate' | 'urgency' | 'rate' | 'link') {
  if (busy.value || props.disabled || loading.value) return;
  if (action === 'start' && !canStart.value || action === 'resolve' && !canResolve.value || action === 'escalate' && !canEscalate.value || action === 'urgency' && (!operator.value || props.report.status === 'confirmed') || action === 'rate' && !canRate.value || action === 'link' && !operator.value) return;
  const current = generation; const reportId = props.report.id;
  busy.value = true; emit('busy', true); error.value = ''; message.value = '';
  try {
    let saved: Report | undefined;
    if (action === 'start') saved = await api.startReport(reportId);
    if (action === 'resolve') saved = await api.resolveReport(reportId, description.value);
    if (action === 'escalate') saved = await api.escalateReport(reportId, escalation.value);
    if (action === 'urgency') saved = await api.overrideReportUrgency(reportId, urgency.value, urgencyReason.value);
    if (action === 'rate') await api.rateReportResolution(reportId, Number(resolutionId.value), Number(score.value), feedback.value);
    if (action === 'link') await api.linkReports(reportId, Number(linkedId.value), linkReason.value);
    if (current !== generation) return;
    if (saved) { if (saved.id !== reportId) throw new Error('The report response did not match the requested report.'); emit('saved', saved); }
    else { if (!await loadDetails()) return; resolutionId.value = ''; score.value = ''; feedback.value = ''; linkedId.value = ''; linkReason.value = ''; }
    if (!saved) message.value = 'Saved by the service.';
  } catch (err) { if (current === generation) error.value = errorMessage(err); }
  finally { busy.value = false; emit('busy', false); }
}
</script>
<template>
  <section class="detail-section workflow-panel">
    <div class="card-heading"><h2>{{ t('Repair workflow') }}</h2><button type="button" class="text-action" :disabled="busy || disabled || loading" @click="loadDetails">{{ t('Refresh workflow') }}</button></div>
    <p v-if="error" role="alert" class="live-error">{{ t(error) }}</p><p v-if="message" role="status">{{ t(message) }}</p>
    <p v-if="loading" role="status">{{ t('Loading workflow…') }}</p>
    <p v-for="failure in readErrors" :key="failure.label" role="alert" class="live-error">{{ t(failure.label) }}: {{ t(failure.error) }}</p>
    <fieldset :disabled="busy || disabled || loading" class="workflow-actions">
      <button v-if="canStart" type="button" class="report-issue-button" @click="perform('start')">{{ t('Start work') }}</button>
      <form v-if="canResolve" @submit.prevent="perform('resolve')"><label>{{ t('Work completed and resolution details') }}<textarea v-model="description" required maxlength="10000" rows="4" /></label><button type="submit" class="report-issue-button">{{ t('Submit resolution for confirmation') }}</button></form>
      <details v-if="canEscalate"><summary>{{ t('Escalate report') }}</summary><form @submit.prevent="perform('escalate')"><label>{{ t('Escalation reason') }}<textarea v-model="escalation" required maxlength="2000" /></label><button type="submit" class="text-action">{{ t('Submit escalation') }}</button></form></details>
      <details v-if="operator && report.status !== 'confirmed'"><summary>{{ t('Override final urgency') }}</summary><form @submit.prevent="perform('urgency')"><label>{{ t('Final urgency') }}<select v-model="urgency"><option v-for="level in ['low','medium','high','critical']" :key="level" :value="level">{{ t(humanize(level)) }}</option></select></label><label>{{ t('Reason for urgency override') }}<textarea v-model="urgencyReason" required maxlength="2000" /></label><button type="submit" class="text-action">{{ t('Save urgency override') }}</button></form></details>
      <details v-if="canRate && resolutions?.length"><summary>{{ t('Rate a completed repair') }}</summary><form @submit.prevent="perform('rate')"><label>{{ t('Repair resolution') }}<select v-model="resolutionId" required><option disabled value="">{{ t('Choose a resolution') }}</option><option v-for="item in resolutions" :key="item.id" :value="item.id">#{{ item.id }} · {{ formatDate(item.createdAt, true) }}</option></select></label><label>{{ t('Score') }}<select v-model="score" required><option disabled value="">{{ t('Choose a score') }}</option><option v-for="value in 5" :key="value" :value="value">{{ value }} / 5</option></select></label><label>{{ t('Feedback (optional)') }}<textarea v-model="feedback" maxlength="2000" /></label><button type="submit" class="text-action">{{ t('Submit rating') }}</button></form></details>
      <details v-if="operator"><summary>{{ t('Link another report') }}</summary><form @submit.prevent="perform('link')"><label>{{ t('Related report ID') }}<input v-model="linkedId" type="number" min="1" step="1" required /></label><label>{{ t('Reason for linking') }}<textarea v-model="linkReason" required maxlength="2000" /></label><button type="submit" class="text-action">{{ t('Save report link') }}</button></form></details>
    </fieldset>
    <section v-if="resolutions"><h3>{{ t('Repair resolutions') }}</h3><p v-if="!resolutions.length">{{ t('No resolutions recorded.') }}</p><article v-for="item in resolutions" :key="item.id"><strong>#{{ item.id }} · {{ formatDate(item.createdAt, true) }}</strong><p class="workflow-copy">{{ item.description }}</p></article></section>
    <section v-if="ratings"><h3>{{ t('Repair ratings') }}</h3><p v-if="!ratings.length">{{ t('No ratings recorded.') }}</p><article v-for="item in ratings" :key="item.id"><strong>{{ item.score }} / 5 · {{ t('Resolution') }} #{{ item.resolutionId }}</strong><p v-if="item.feedback" class="workflow-copy">{{ item.feedback }}</p></article></section>
    <section v-if="links"><h3>{{ t('Linked reports') }}</h3><p v-if="!links.length">{{ t('No linked reports.') }}</p><article v-for="item in links" :key="item.id"><RouterLink :to="`/reports/${item.reportId === report.id ? item.linkedReportId : item.reportId}`">{{ t('Report') }} #{{ item.reportId === report.id ? item.linkedReportId : item.reportId }}</RouterLink><p class="workflow-copy">{{ item.reason }}</p></article></section>
    <section v-if="history"><h3>{{ t('Report history') }}</h3><p v-if="!history.length">{{ t('No history available.') }}</p><ol><li v-for="item in history" :key="item.id"><strong>{{ item.fromStatus ? t(humanize(item.fromStatus)) + ' → ' : '' }}{{ t(humanize(item.toStatus)) }}</strong> · {{ formatDate(item.createdAt, true) }}<p v-if="item.note" class="workflow-copy">{{ item.note }}</p></li></ol></section>
  </section>
</template>
<style scoped>
.workflow-panel h3{font-size:17px;font-weight:650;margin:22px 0 12px}.workflow-actions{display:grid;gap:18px;margin:20px 0}.workflow-actions form{display:grid;gap:14px;padding-top:14px}.workflow-actions label{display:grid;gap:6px}.workflow-actions textarea,.workflow-actions input,.workflow-actions select{width:100%;padding:12px;border:1px solid #b6c8bf;border-radius:8px;background:white}.workflow-panel article,.workflow-panel li{padding:12px 0;border-bottom:1px solid #e4ebe7;font-size:14px;line-height:1.7}.workflow-copy{white-space:pre-wrap;overflow-wrap:anywhere}.workflow-panel summary{cursor:pointer;font-weight:600}.workflow-panel fieldset:disabled{opacity:.65}
</style>
