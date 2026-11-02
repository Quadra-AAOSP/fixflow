<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useAuth } from '@/composables/useAuth';
import { useMaintenanceStore } from '@/stores/maintenance';
import { listSiteContracts, type TechnicianContract } from '@/services/access';
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
let generation = 0;
onBeforeUnmount(() => { generation++; });
async function load() {
  const current = ++generation;
  const id = scopeId.value;
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
watch(() => [scopeId.value, user.value?.id, props.revision], load, { immediate: true });
</script>

<template>
  <section v-if="allowed" class="contract-choice contract-directory">
    <div class="card-heading">
      <div><h2>{{ t('Recorded site contracts') }}</h2><p v-if="data.selectedSite">{{ data.selectedSite.name }}</p></div>
      <button type="button" class="text-action" :disabled="loading || !scopeId" @click="load">{{ t('Refresh contracts') }}</button>
    </div>
    <p class="dialog-intro">{{ t('These are recorded site relationships, separate from pending contract requests. Each record identifies the technician account and when the contract was created.') }}</p>
    <p v-if="!scopeId">{{ t('Choose an accessible site to view its recorded contracts.') }}</p>
    <p v-else-if="loading" role="status">{{ t('Loading recorded contracts…') }}</p>
    <p v-else-if="error" class="live-error" role="alert">{{ t(error) }}</p>
    <template v-else-if="contracts">
      <p v-if="!contracts.length">{{ t('No contracts are recorded for this site.') }}</p>
      <ul v-else class="contract-records">
        <li v-for="contract in contracts" :key="contract.id">
          <strong>{{ t('Contract #{id}', { id: contract.id }) }}</strong>
          <span>{{ t('Technician #{id}', { id: contract.technicianId }) }}</span>
          <span>{{ t('Created {date}', { date: formatDate(contract.createdAt, true) }) }}</span>
        </li>
      </ul>
    </template>
  </section>
</template>

<style scoped>
.contract-records{display:grid;gap:10px;margin-top:14px}.contract-records li{display:flex;flex-wrap:wrap;align-items:center;gap:10px 22px;border:1px solid #e4ebe7;border-radius:10px;padding:14px;overflow-wrap:anywhere}.contract-records li span{color:#536984;font-size:13px}
</style>
