<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Handshake, ShieldCheck } from '@lucide/vue';
import { useAuth } from '@/composables/useAuth';
import { useMaintenanceStore } from '@/stores/maintenance';
import { createTechnicianContract, type TechnicianContract } from '@/services/access';
import { errorMessage } from '@/services/api';
import { formatDate } from '@/utils/maintenance';
const { user } = useAuth();
const data = useMaintenanceStore();
const isManager = computed(() => user.value?.role === 'admin' || user.value?.role === 'super_admin');
const siteId = ref('');
const technicianId = ref('');
const consent = ref(false);
const busy = ref(false);
const error = ref('');
const created = ref<TechnicianContract | null>(null);
watch(() => data.selectedSiteId, id => { if (!busy.value) siteId.value = id == null ? '' : String(id); }, { immediate: true });
async function submit() {
  if (busy.value) return;
  error.value = ''; created.value = null;
  const technician = Number(technicianId.value);
  const site = Number(siteId.value);
  if (!isManager.value || !Number.isSafeInteger(technician) || technician <= 0 || !data.sites.some(item => item.id === site) || !consent.value) {
    error.value = 'Choose an accessible site, enter a valid technician ID, and confirm their agreement.'; return;
  }
  busy.value = true;
  try { created.value = await createTechnicianContract(technician, site); technicianId.value = ''; consent.value = false; }
  catch (err) { error.value = errorMessage(err); }
  finally { busy.value = false; }
}
</script>
<template>
  <section class="dashboard-card live-page report-form-page"><div class="card-heading"><div><h1>Site contracts</h1><p>Optional site relationships for technicians</p></div><Handshake :size="30" /></div>
    <template v-if="user?.role === 'technician'"><section class="contract-choice"><h2>Stay independent</h2><p>No site contract is required to keep your account. You do not need to apply for one during registration.</p><RouterLink to="/technician" class="text-action">Continue independently →</RouterLink></section><section class="contract-choice"><h2>Request a site contract</h2><p>Ask the site administrator to review your request. Share your technician account ID: <strong>{{ user.id }}</strong>.</p><p class="availability-note">Online requests and request tracking are not available yet. No request has been submitted from this page.</p><button class="report-issue-button" disabled aria-describedby="contract-request-unavailable">Online requests unavailable</button><p id="contract-request-unavailable" class="dialog-intro">Your site administrator can record an agreed contract. An account without a site ID can still have contracts; your current contract list is not available here.</p></section></template>
    <template v-else-if="isManager"><p class="dialog-intro">Record a site contract only after the technician has agreed. This creates a contract directly; it does not process an online request or record an approval history.</p><div v-if="created" role="status" class="draft-notice">Contract #{{ created.id }} created for technician #{{ created.technicianId }} at {{ data.siteName(created.siteId) }} on {{ formatDate(created.createdAt, true) }}.</div><p v-if="data.loading" class="live-empty">Loading sites…</p><p v-else-if="!data.sites.length" class="live-empty">An accessible site is required to record a contract.</p><form v-else class="draft-form" @submit.prevent="submit"><p v-if="error" role="alert" class="live-error">{{ error }}</p><fieldset class="report-fields" :disabled="busy"><label>Site<select v-model="siteId" required><option disabled value="">Choose a site</option><option v-for="site in data.sites" :key="site.id" :value="String(site.id)">{{ site.name }}</option></select></label><label>Technician account ID<input v-model="technicianId" type="number" min="1" step="1" required /></label><label class="consent-row"><input v-model="consent" type="checkbox" required /><span>The technician has agreed to this site contract.</span></label><button class="report-issue-button" :disabled="busy" type="submit"><ShieldCheck :size="18" />{{ busy ? 'Saving…' : 'Record agreed contract' }}</button></fieldset></form><p class="dialog-intro">Existing contracts and pending requests cannot be listed in this version.</p></template>
  </section>
</template>
