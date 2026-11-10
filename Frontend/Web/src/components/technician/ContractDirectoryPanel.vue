<script setup lang="ts">
import SiteVettingPanel from '@/components/technician/SiteVettingPanel.vue';
import LoadingStatus from '@/components/ui/LoadingStatus.vue';
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useAuth } from '@/composables/useAuth';
import { useMaintenanceStore } from '@/stores/maintenance';
import { deleteTechnicianContract, listSiteContracts, type TechnicianContract } from '@/services/access';
import { getTechnicianTermsFor } from '@/services/technician';
import type { TechnicianTermsStatus } from '@/types/technician';
import { errorMessage } from '@/services/api';
import { formatDate } from '@/utils/maintenance';
import { useLocale } from '@/i18n';

const props = defineProps<{ revision?: number }>();
const { user } = useAuth();
const data = useMaintenanceStore();
const { t } = useLocale();
const allowed = computed(() => user.value?.role === 'super_admin' || user.value?.role === 'admin');
const scopeId = computed(() => {
  const id = data.selectedSite?.id;
  if (!allowed.value || !id || user.value?.role === 'admin' && user.value.siteId !== id) return null;
  return id;
});
const contracts = ref<TechnicianContract[] | null>(null);
const loading = ref(false);
const error = ref('');
const actionBusy = ref(false);
const actionError = ref('');
const message = ref('');
const removing = ref<TechnicianContract | null>(null);
const terms = ref<TechnicianTermsStatus | null>(null);
const confirmation = ref<HTMLElement>();
const termsPanel = ref<HTMLElement>();
let actionVersion = 0;
let generation = 0;
onBeforeUnmount(() => { generation++; actionVersion++; });
async function load() {
  const current = ++generation;
  const id = scopeId.value;
  actionVersion++; actionBusy.value = false; actionError.value = ''; message.value = ''; removing.value = null; terms.value = null;
  contracts.value = null; error.value = ''; loading.value = false;
  if (!id) return;
  loading.value = true;
  try {
    const result = await listSiteContracts(id);
    if (current !== generation) return;
    if (!Array.isArray(result) || result.some(item => item.siteId !== id)) {
      throw new Error('The contract list did not match the selected site. Refresh and try again.');
    }
    contracts.value = result;
  } catch (err) { if (current === generation) error.value = errorMessage(err); }
  finally { if (current === generation) loading.value = false; }
}
async function inspectTerms(contract: TechnicianContract) {
  if (actionBusy.value || !scopeId.value || contract.siteId !== scopeId.value) return;
  const current = ++actionVersion; actionBusy.value = true; actionError.value = ''; terms.value = null;
  try {
    const result = await getTechnicianTermsFor(contract.technicianId);
    if (current !== actionVersion) return;
    if (result.technicianId !== contract.technicianId) throw new Error('The terms response did not match the technician.');
    terms.value = result;
  } catch (err) { if (current === actionVersion) actionError.value = errorMessage(err); }
  finally { if (current === actionVersion) { actionBusy.value = false; if (terms.value) { await nextTick(); termsPanel.value?.focus(); } } }
}
async function askRemove(contract: TechnicianContract) {
  if (actionBusy.value || contract.siteId !== scopeId.value) return;
  removing.value = contract; message.value = ''; actionError.value = '';
  await nextTick(); confirmation.value?.focus();
}
async function remove() {
  const target = removing.value;
  if (!allowed.value || !target || actionBusy.value || target.siteId !== scopeId.value) return;
  const current = ++actionVersion; actionBusy.value = true; actionError.value = '';
  try {
    await deleteTechnicianContract(target.id);
    if (current !== actionVersion) return;
    contracts.value = contracts.value?.filter(row => row.id !== target.id) ?? null;
    removing.value = null; terms.value = null; message.value = 'Recorded relationship removed.';
  } catch (err) { if (current === actionVersion) actionError.value = errorMessage(err); }
  finally { if (current === actionVersion) actionBusy.value = false; }
}
watch(() => [scopeId.value, user.value?.id, props.revision], load, { immediate: true });
</script>

<template>
  <SiteVettingPanel v-if="scopeId" :key="scopeId" :site-id="scopeId" :technicians="contracts?.map(c => c.technicianId) ?? []" />
  <section v-if="allowed" class="contract-choice contract-directory">
    <div class="card-heading">
      <div><h2>{{ t('Recorded site contracts') }}</h2><p v-if="data.selectedSite">{{ data.selectedSite.name }}</p></div>
      <button type="button" class="text-action" :disabled="loading || actionBusy || !scopeId" @click="load">{{ t('Refresh contracts') }}</button>
    </div>
    <p class="dialog-intro">{{ t('These are recorded site relationships, separate from pending contract requests. Each record identifies the technician account and when the contract was created.') }}</p>
    <p v-if="!scopeId">{{ t('Choose an accessible site to view its recorded contracts.') }}</p>
    <LoadingStatus v-else-if="loading" :label="t('Loading recorded contracts…')" />
    <p v-else-if="error" class="live-error" role="alert">{{ t(error) }}</p>
    <p v-if="actionError" class="live-error" role="alert">{{ t(actionError) }}</p>
    <p v-if="message" class="draft-notice" role="status">{{ t(message) }}</p>
    <section v-if="removing" ref="confirmation" tabindex="-1" class="draft-notice contract-confirmation" :aria-label="t('Remove recorded relationship')">
      <p>{{ t('Permanently remove contract #{id} for technician #{technician}? This removes the recorded site relationship and affects future eligibility. Existing report assignments are unchanged.', { id: removing.id, technician: removing.technicianId }) }}</p>
      <p>{{ t('This action removes a database record; it does not cancel a legal agreement or create a contract termination history.') }}</p>
      <button type="button" class="text-action" :disabled="actionBusy" @click="remove">{{ t('Remove relationship permanently') }}</button>
      <button type="button" class="text-action" :disabled="actionBusy" @click="removing = null">{{ t('Cancel') }}</button>
    </section>
    <section v-if="terms" ref="termsPanel" tabindex="-1" class="draft-notice terms-inspection" :aria-label="t('Technician terms status')">
      <h3>{{ t('Terms for technician #{id}', { id: terms.technicianId }) }}</h3>
      <p>{{ t('Current version') }}: {{ terms.currentVersion || t('Not configured') }}</p>
      <p>{{ t(terms.acceptedCurrentVersion ? 'Current terms accepted' : 'Current terms not accepted') }}</p>
      <p>{{ t(terms.enforcementRequired ? 'Terms acceptance is required.' : 'Terms acceptance is not enforced by the server.') }}</p>
      <ul><li v-for="entry in terms.acceptances" :key="entry.version + entry.acceptedAt">{{ entry.version }} · {{ formatDate(entry.acceptedAt, true) }}</li></ul>
      <button type="button" class="text-action" @click="terms = null">{{ t('Close') }}</button>
    </section>
    <template v-if="!loading && !error && contracts">
      <p v-if="!contracts.length">{{ t('No contracts are recorded for this site.') }}</p>
      <ul v-else class="contract-records">
        <li v-for="contract in contracts" :key="contract.id">
          <strong>{{ t('Contract #{id}', { id: contract.id }) }}</strong>
          <span>{{ t('Technician #{id}', { id: contract.technicianId }) }}</span>
          <span>{{ t('Created {date}', { date: formatDate(contract.createdAt, true) }) }}</span>
          <button type="button" class="text-action" :disabled="actionBusy" @click="inspectTerms(contract)">{{ t('View terms status') }}</button>
          <button type="button" class="text-action" :disabled="actionBusy" @click="askRemove(contract)">{{ t('Remove relationship') }}</button>
        </li>
      </ul>
    </template>
  </section>
</template>

<style scoped>
.contract-confirmation,.terms-inspection{display:block;line-height:1.8}.contract-confirmation p,.terms-inspection p{margin:8px 0}.contract-confirmation button{margin-right:18px}.terms-inspection h3{font-size:14px;font-weight:650}
.contract-records{display:grid;gap:10px;margin-top:14px}.contract-records li{display:flex;flex-wrap:wrap;align-items:center;gap:10px 22px;border:1px solid #e4ebe7;border-radius:10px;padding:14px;overflow-wrap:anywhere}.contract-records li span{color:#536984;font-size:13px}
</style>
