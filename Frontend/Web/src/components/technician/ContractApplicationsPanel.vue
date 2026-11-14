<script setup lang="ts">
import LoadingStatus from '@/components/ui/LoadingStatus.vue';
import { useLocale } from '@/i18n';
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { useAuth } from '@/composables/useAuth';
import { decideContractApplication, listContractApplications, requestTechnicianContract } from '@/services/access';
import { ApiError, errorMessage } from '@/services/api';
import { positiveId } from '@/utils/registration';
import { formatDate } from '@/utils/maintenance';
import TechnicianTermsPanel from '@/components/TechnicianTermsPanel.vue';
import type { ContractApplication, TechnicianTermsStatus } from '@/types/technician';
const { t } = useLocale();

const { user } = useAuth();
const props = defineProps<{ initialSiteId?: number }>();
const emit = defineEmits<{ contractCreated: [] }>();
const technician = computed(() => user.value?.role === 'technician');
const siteAdmin = computed(() => user.value?.role === 'admin');
const items = ref<ContractApplication[]>([]);
const loading = ref(false);
const submitting = ref(false);
const decidingId = ref<number | null>(null);
const error = ref('');
const success = ref<ContractApplication | null>(null);
const submittedRequest = ref(false);
const siteId = ref(props.initialSiteId == null ? '' : String(props.initialSiteId));
const note = ref('');
const reasons = reactive<Record<number, string>>({});
const terms = ref<TechnicianTermsStatus | null>(null);
const termsPanel = ref<InstanceType<typeof TechnicianTermsPanel>>();
const canRequest = computed(() => !!terms.value?.currentVersion && !!terms.value.documentUrl && terms.value.acceptedCurrentVersion);
function formatFee(minor: number | null | undefined, currency = 'USD') {
  if (minor == null) return t('Not set');
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD' }).format(minor / 100);
}
let generation = 0;
onBeforeUnmount(() => { generation++; });

async function load() {
  const current = ++generation;
  items.value = []; success.value = null;
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
  error.value = ''; success.value = null;
  const current = generation;
  try {
    const target = positiveId(String(siteId.value));
    if (note.value.length > 1000) throw new Error('Use a note of 1,000 characters or fewer.');
    submitting.value = true;
    const saved = await requestTechnicianContract(target, note.value);
    if (current !== generation) return;
    items.value = [saved, ...items.value.filter(item => item.id !== saved.id)];
    note.value = ''; siteId.value = '';
    success.value = saved; submittedRequest.value = true;
  } catch (err) {
    if (current !== generation) return;
    error.value = errorMessage(err);
    if (err instanceof ApiError && err.status === 409) await termsPanel.value?.refresh();
  } finally { submitting.value = false; }
}

async function decide(item: ContractApplication, decision: 'approve' | 'reject') {
  if (!siteAdmin.value || item.siteId !== user.value?.siteId || item.status !== 'pending' || decidingId.value !== null) return;
  const current = generation;
  decidingId.value = item.id; error.value = ''; success.value = null;
  try {
    const saved = await decideContractApplication(item.id, decision, reasons[item.id] ?? '');
    if (current !== generation) return;
    items.value = items.value.map(row => row.id === saved.id ? saved : row);
    success.value = saved; submittedRequest.value = false;
    if (saved.status === 'approved') emit('contractCreated');
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
        <h2>{{ t("Request a site contract") }}</h2>
        <p>{{ t("Use the site ID supplied by the site administrator. They will review your request; sending it does not create a contract.") }}</p>
        <p v-if="!canRequest" class="dialog-intro">{{ t("Review and accept the current terms above if required. Terms status must load before you can send a request.") }}</p>
        <form class="draft-form" @submit.prevent="submit"><fieldset class="report-fields" :disabled="submitting || loading || !canRequest">
          <label>{{ t("Site ID") }}<input v-model="siteId" type="number" min="1" step="1" required /></label>
          <label>{{ t("Note to the site administrator (optional)") }}<textarea v-model="note" rows="3" maxlength="1000" /></label>
          <button type="submit" class="report-issue-button">{{ t(submitting ? 'Sending request…' : 'Send contract request') }}</button>
        </fieldset></form>
      </section>
    </template>
    <section class="contract-choice">
      <div class="card-heading"><h2>{{ t(technician ? 'Your contract requests' : 'Site contract requests') }}</h2><button type="button" class="text-action" :disabled="loading || submitting || decidingId !== null" @click="load">{{ t("Refresh requests") }}</button></div>
      <p v-if="siteAdmin" class="dialog-intro">{{ t("Only your site’s requests appear here. Approval creates the site contract after the backend checks current terms acceptance. The site’s configured flat fee is snapshotted onto the contract.") }}</p>
      <p v-if="success" role="status" class="draft-notice">{{ submittedRequest ? t('Request #{id} submitted to site #{siteId}.', { id: success.id, siteId: success.siteId }) : t('Request #{id} {status}.', { id: success.id, status: t(success.status) }) }}</p>
      <p v-if="error" role="alert" class="live-error">{{ t(error) }}</p>
      <LoadingStatus v-if="loading" :label="t('Loading requests…')" />
      <p v-else-if="!error && !items.length">{{ t("No requests yet.") }}</p>
      <ul v-else class="contract-request-list">
        <li v-for="item in items" :key="item.id" class="dashboard-card">
          <div class="card-heading"><h3>{{ t('Request #{id}', { id: item.id }) }}</h3><span class="status-badge mint">{{ t(item.status) }}</span></div>
          <p>{{ t('Site #{siteId} · Technician #{technicianId}', { siteId: item.siteId, technicianId: item.technicianId }) }}</p>
          <p>{{ t('Contract flat fee: {fee}', { fee: formatFee(item.siteFlatFeeMinor, item.siteFeeCurrency) }) }}</p>
          <p>{{ t('Submitted {date}', { date: formatDate(item.createdAt, true) }) }}</p>
          <p v-if="item.note">{{ item.note }}</p>
          <p v-if="item.decisionReason">{{ t('Decision: {reason}', { reason: item.decisionReason }) }}</p>
          <p v-if="item.decidedAt">{{ t('Reviewed {date}', { date: formatDate(item.decidedAt, true) }) }}</p>
          <div v-if="siteAdmin && item.status === 'pending'" class="report-fields">
            <label :for="`reason-${item.id}`">{{ t("Decision reason (optional)") }}</label>
            <textarea :id="`reason-${item.id}`" v-model="reasons[item.id]" maxlength="1000" rows="2" :disabled="decidingId !== null" />
            <div class="flex gap-3"><button type="button" class="report-issue-button" :disabled="decidingId !== null" @click="decide(item, 'approve')">{{ t('Approve request #{id}', { id: item.id }) }}</button><button type="button" class="text-action" :disabled="decidingId !== null" @click="decide(item, 'reject')">{{ t('Reject request #{id}', { id: item.id }) }}</button></div>
          </div>
        </li>
      </ul>
    </section>
  </section>
</template>

<style scoped>
.contract-request-list{display:grid;gap:14px}.contract-request-list p{overflow-wrap:anywhere}.contract-request-list .report-fields{margin-top:12px}.contract-applications{display:grid;gap:12px}
</style>
