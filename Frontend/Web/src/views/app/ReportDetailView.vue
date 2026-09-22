<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { ArrowLeft, RefreshCw } from '@lucide/vue';
import { useAuth } from '@/composables/useAuth';
import { useMaintenanceStore } from '@/stores/maintenance';
import * as api from '@/services/maintenance';
import { ApiError, errorMessage } from '@/services/api';
import { formatDate, humanize, statusLabels, statusTone, urgencyLabels } from '@/utils/maintenance';
import type { Report, ReportReporter } from '@/types/maintenance';

const route = useRoute();
const { user } = useAuth();
const data = useMaintenanceStore();
const report = ref<Report | null>(null);
const reporters = ref<ReportReporter[]>([]);
const reportersLoaded = ref(false);
const reportersError = ref('');
const loading = ref(false);
const error = ref('');
const actionError = ref('');
const message = ref('');
const busy = ref(false);
const technicianId = ref('');
let generation = 0;
onBeforeUnmount(() => { generation++; });
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
async function assign() {
  if (!report.value || busy.value) return;
  const id = Number(technicianId.value);
  if (!Number.isSafeInteger(id) || id <= 0) { actionError.value = 'Enter a valid technician ID.'; return; }
  const version = generation;
  busy.value = true; actionError.value = ''; message.value = '';
  try {
    const result = await api.assignTechnician(report.value.id, id);
    if (version !== generation) return;
    report.value = result; data.upsert(result); technicianId.value = ''; message.value = 'Technician assignment saved.';
  } catch (err) { if (version === generation) actionError.value = errorMessage(err); }
  finally { busy.value = false; }
}
</script>
<template>
  <section class="dashboard-card live-page"><div class="card-heading"><RouterLink class="text-action" to="/reports"><ArrowLeft :size="16" />All reports</RouterLink><button class="icon-button" :disabled="loading || busy" aria-label="Reload report" @click="load"><RefreshCw :size="17" /></button></div><p v-if="loading" class="live-empty" role="status">Loading report…</p><p v-else-if="error" role="alert" class="live-error">{{ error }}</p>
    <template v-else-if="report"><div class="card-heading"><h1>Report #{{ report.id }}</h1><span class="status-badge" :class="statusTone(report.status)">{{ statusLabels[report.status] }}</span></div><p class="report-description">{{ report.description }}</p>
      <dl class="report-detail-grid"><div><dt>Site</dt><dd>{{ data.siteName(report.siteId) }}</dd></div><div><dt>Location</dt><dd>{{ report.address || 'Not shared or not provided' }}</dd></div><div><dt>Category</dt><dd>{{ humanize(report.category) }}</dd></div><div><dt>Specialty</dt><dd>{{ report.specialty ? humanize(report.specialty) : 'Not specified' }}</dd></div><div><dt>Reported by</dt><dd>{{ report.createdByName || 'Not shared' }}</dd></div><div><dt>Technician</dt><dd>{{ report.assignedTechnicianId == null ? 'Unassigned' : `Technician #${report.assignedTechnicianId}` }}</dd></div><div><dt>Reporter urgency</dt><dd>{{ urgencyLabels[report.reporterUrgency] }}</dd></div><div><dt>AI urgency</dt><dd>{{ report.aiUrgency ? urgencyLabels[report.aiUrgency] : 'Not classified' }}</dd></div><div><dt>Final urgency</dt><dd>{{ report.finalUrgency ? urgencyLabels[report.finalUrgency] : 'Not determined' }}</dd></div><div><dt>Urgency reason</dt><dd>{{ report.reporterReason || 'Not shared or not provided' }}</dd></div><div><dt>Created</dt><dd>{{ formatDate(report.createdAt, true) }}</dd></div><div><dt>Updated</dt><dd>{{ formatDate(report.updatedAt, true) }}</dd></div><div><dt>Times reopened</dt><dd>{{ report.reopenCount }}</dd></div></dl>
      <p v-if="message" class="draft-notice" role="status">{{ message }}</p><p v-if="actionError" class="live-error" role="alert">{{ actionError }}</p>
      <section class="detail-section"><h2>People attached to this report</h2><p v-if="reportersError" class="live-error">{{ reportersError }}</p><ul v-else-if="reportersLoaded" class="reporter-list"><li v-for="person in reporters" :key="person.userId">{{ person.userId === user?.id ? 'You' : `User #${person.userId}` }}<span>Joined {{ formatDate(person.joinedAt, true) }}</span></li></ul><p v-else class="dialog-intro">Reporter identities are only available to people with access to this report.</p><button v-if="user?.role === 'reporter' && !joined" class="report-issue-button" :disabled="busy" @click="join">{{ busy ? 'Saving…' : 'This issue affects me too' }}</button><p v-if="user?.role === 'reporter' && !joined" class="dialog-intro">Joining attaches your account to the report and gives you access to its shared details.</p></section>
      <section v-if="data.canAssign" class="detail-section"><h2>{{ report.assignedTechnicianId ? 'Reassign technician' : 'Assign a technician' }}</h2><p class="dialog-intro">Enter the technician’s account ID supplied by your administrator.</p><form class="assignment-form" @submit.prevent="assign"><label>Technician ID<input v-model="technicianId" type="number" min="1" step="1" required :disabled="busy" /></label><button class="report-issue-button" :disabled="busy" type="submit">{{ busy ? 'Saving…' : 'Save assignment' }}</button></form></section>
    </template>
  </section>
</template>
