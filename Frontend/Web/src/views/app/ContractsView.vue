<script setup lang="ts">
import { useLocale } from '@/i18n';
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import ContractApplicationsPanel from '@/components/technician/ContractApplicationsPanel.vue';
import { Handshake, ShieldCheck } from '@lucide/vue';
import { useAuth } from '@/composables/useAuth';
import { useMaintenanceStore } from '@/stores/maintenance';
import { createTechnicianContract, type TechnicianContract } from '@/services/access';
import { errorMessage } from '@/services/api';
import { formatDate } from '@/utils/maintenance';
const { t } = useLocale();
const { user } = useAuth();
const route = useRoute();
const initialSiteId = computed(() => {
  const id = Number(route.query.siteId);
  return Number.isSafeInteger(id) && id > 0 ? id : undefined;
});
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
  <section class="dashboard-card live-page report-form-page"><div class="card-heading"><div><h1>{{ t("Site contracts") }}</h1><p>{{ t("Optional site relationships for technicians") }}</p></div><Handshake :size="30" /></div>
    <template v-if="user?.role === 'technician'"><section class="contract-choice"><h2>{{ t("Stay independent") }}</h2><p>{{ t("No site contract is required to keep your account. You can continue independently or request a site contract below.") }}</p><RouterLink to="/technician" class="text-action">{{ t("Continue independently →") }}</RouterLink></section></template>
    <template v-else-if="isManager"><p class="dialog-intro">{{ t("Record a site contract only after the technician has agreed. This creates a contract directly; it does not process an online request or record an approval history.") }}</p><div v-if="created" role="status" class="draft-notice">{{ t('Contract #{id} created for technician #{technicianId} at {site} on {date}.', { id: created.id, technicianId: created.technicianId, site: data.siteName(created.siteId), date: formatDate(created.createdAt, true) }) }}</div><p v-if="data.loading" class="live-empty">{{ t("Loading sites…") }}</p><p v-else-if="!data.sites.length" class="live-empty">{{ t("An accessible site is required to record a contract.") }}</p><form v-else class="draft-form" @submit.prevent="submit"><p v-if="error" role="alert" class="live-error">{{ t(error) }}</p><fieldset class="report-fields" :disabled="busy"><label>{{ t("Site") }}<select v-model="siteId" required><option disabled value="">{{ t("Choose a site") }}</option><option v-for="site in data.sites" :key="site.id" :value="String(site.id)">{{ site.name }}</option></select></label><label>{{ t("Technician account ID") }}<input v-model="technicianId" type="number" min="1" step="1" required /></label><label class="consent-row"><input v-model="consent" type="checkbox" required /><span>{{ t("The technician has agreed to this site contract.") }}</span></label><button class="report-issue-button" :disabled="busy" type="submit"><ShieldCheck :size="18" />{{ t(busy ? 'Saving…' : 'Record agreed contract') }}</button></fieldset></form><p class="dialog-intro">{{ t("The request history below is separate from direct contract creation.") }}</p></template>
    <ContractApplicationsPanel :initial-site-id="initialSiteId" />
  </section>
</template>
