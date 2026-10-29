<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { useAuth } from '@/composables/useAuth';
import { decideContractApplication, listContractApplications, requestTechnicianContract } from '@/services/access';
import { ApiError, errorMessage } from '@/services/api';
import { positiveId } from '@/utils/registration';
import { formatDate } from '@/utils/maintenance';
import TechnicianTermsPanel from '@/components/TechnicianTermsPanel.vue';
import type { ContractApplication, TechnicianTermsStatus } from '@/types/technician';

const { user } = useAuth();
const technician = computed(() => user.value?.role === 'technician');
const siteAdmin = computed(() => user.value?.role === 'admin');
const items = ref<ContractApplication[]>([]);
const loading = ref(false);
const submitting = ref(false);
const decidingId = ref<number | null>(null);
const error = ref('');
const success = ref('');
const siteId = ref('');
const note = ref('');
const reasons = reactive<Record<number, string>>({});
const terms = ref<TechnicianTermsStatus | null>(null);
const termsPanel = ref<InstanceType<typeof TechnicianTermsPanel>>();
const canRequest = computed(() => !!terms.value && (!terms.value.enforcementRequired || terms.value.acceptedCurrentVersion));
let generation = 0;
onBeforeUnmount(() => { generation++; });

async function load() {
  const current = ++generation;
  items.value = [];
  error.value = '';
  loading.value = false;
  if (!technician.value && !siteAdmin.value) return;
  if (siteAdmin.value && user.value?.siteId == null) return;
  loading.value = true;
  try {
    const result = await listContractApplications(siteAdmin.value ? user.value!.siteId! : undefined);
    if (current === generation) items.value = result;
  } catch (err) { if (current === generation) error.value = errorMessage(err); }
  finally { if (current === generation) loading.value = false; }
}

watch(() => [user.value?.id, user.value?.role, user.value?.siteId], load, { immediate: true });

async function submit() {
  if (!technician.value || !canRequest.value || submitting.value || loading.value) return;
  error.value = ''; success.value = '';
  const current = generation;
  try {
    const target = positiveId(siteId.value);
    if (note.value.length > 1000) throw new Error('Use a note of 1,000 characters or fewer.');
    submitting.value = true;
    const saved = await requestTechnicianContract(target, note.value);
    if (current !== generation) return;
    items.value = [saved, ...items.value.filter(item => item.id !== saved.id)];
    note.value = ''; siteId.value = '';
    success.value = `Request #${saved.id} submitted to site #${saved.siteId}.`;
  } catch (err) {
    if (current !== generation) return;
    error.value = errorMessage(err);
    if (err instanceof ApiError && err.status === 409) await termsPanel.value?.refresh();
  } finally { submitting.value = false; }
}

async function decide(item: ContractApplication, decision: 'approve' | 'reject') {
  if (!siteAdmin.value || item.siteId !== user.value?.siteId || item.status !== 'pending' || decidingId.value !== null) return;
  const current = generation;
  decidingId.value = item.id; error.value = ''; success.value = '';
  try {
    const saved = await decideContractApplication(item.id, decision, reasons[item.id] ?? '');
    if (current !== generation) return;
    items.value = items.value.map(row => row.id === saved.id ? saved : row);
    success.value = `Request #${saved.id} ${saved.status}.`;
    delete reasons[item.id];
  } catch (err) { if (current === generation) error.value = errorMessage(err); }
  finally { decidingId.value = null; }
}
</script>

<template>
  <section v-if="technician || siteAdmin" class="contract-applications">
    <template v-if="technician">
      <TechnicianTermsPanel ref="termsPanel" @change="terms = $event" />
      <section class="contract-choice">
        <h2>Request a site contract</h2>
        <p>Use the site ID supplied by the site administrator. They will review your request; sending it does not create a contract.</p>
        <p v-if="!canRequest" class="dialog-intro">Review and accept the current terms above if required. Terms status must load before you can send a request.</p>
        <form class="draft-form" @submit.prevent="submit"><fieldset class="report-fields" :disabled="submitting || loading || !canRequest">
          <label>Site ID<input v-model="siteId" type="number" min="1" step="1" required /></label>
          <label>Note to the site administrator (optional)<textarea v-model="note" rows="3" maxlength="1000" /></label>
          <button type="submit" class="report-issue-button">{{ submitting ? 'Sending request…' : 'Send contract request' }}</button>
        </fieldset></form>
      </section>
    </template>
    <section class="contract-choice">
      <div class="card-heading"><h2>{{ technician ? 'Your contract requests' : 'Site contract requests' }}</h2><button type="button" class="text-action" :disabled="loading || submitting || decidingId !== null" @click="load">Refresh requests</button></div>
      <p v-if="siteAdmin" class="dialog-intro">Only your site’s requests appear here. Approval creates the site contract after the backend checks current terms acceptance.</p>
      <p v-if="success" role="status" class="draft-notice">{{ success }}</p>
      <p v-if="error" role="alert" class="live-error">{{ error }}</p>
      <p v-if="loading" role="status">Loading requests…</p>
      <p v-else-if="!error && !items.length">No requests yet.</p>
      <ul v-else class="contract-request-list">
        <li v-for="item in items" :key="item.id" class="dashboard-card">
          <div class="card-heading"><h3>Request #{{ item.id }}</h3><span class="status-badge mint">{{ item.status }}</span></div>
          <p>Site #{{ item.siteId }} · Technician #{{ item.technicianId }}</p>
          <p>Submitted {{ formatDate(item.createdAt, true) }}</p>
          <p v-if="item.note">{{ item.note }}</p>
          <p v-if="item.decisionReason">Decision: {{ item.decisionReason }}</p>
          <p v-if="item.decidedAt">Reviewed {{ formatDate(item.decidedAt, true) }}</p>
          <div v-if="siteAdmin && item.status === 'pending'" class="report-fields">
            <label :for="`reason-${item.id}`">Decision reason (optional)</label>
            <textarea :id="`reason-${item.id}`" v-model="reasons[item.id]" maxlength="1000" rows="2" :disabled="decidingId !== null" />
            <div class="flex gap-3"><button type="button" class="report-issue-button" :disabled="decidingId !== null" @click="decide(item, 'approve')">Approve request #{{ item.id }}</button><button type="button" class="text-action" :disabled="decidingId !== null" @click="decide(item, 'reject')">Reject request #{{ item.id }}</button></div>
          </div>
        </li>
      </ul>
    </section>
  </section>
</template>

<style scoped>
.contract-request-list{display:grid;gap:14px}.contract-request-list p{overflow-wrap:anywhere}.contract-request-list .report-fields{margin-top:12px}.contract-applications{display:grid;gap:12px}
</style>
