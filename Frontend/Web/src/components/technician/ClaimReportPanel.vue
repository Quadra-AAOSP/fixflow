<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '@/composables/useAuth';
import { useMaintenanceStore } from '@/stores/maintenance';
import { claimReport } from '@/services/reportWorkflow';
import { errorMessage } from '@/services/api';
import { useLocale } from '@/i18n';
const { t } = useLocale(); const { user } = useAuth(); const router = useRouter(); const data = useMaintenanceStore();
const reportId = ref(''); const busy = ref(false); const error = ref('');
let disposed = false; onBeforeUnmount(() => { disposed = true; });
async function claim() {
  if (busy.value || user.value?.role !== 'technician') return;
  const actorId = user.value.id; const id = Number(reportId.value); busy.value = true; error.value = '';
  try {
    const saved = await claimReport(id);
    if (disposed || user.value?.id !== actorId || user.value.role !== 'technician') return;
    if (saved.id !== id) throw new Error('The report response did not match the requested report.');
    data.upsert(saved); await router.push(`/reports/${saved.id}`);
  } catch (err) { if (!disposed && user.value?.id === actorId) error.value = errorMessage(err); }
  finally { busy.value = false; }
}
</script>
<template>
  <section v-if="user?.role === 'technician'" class="dashboard-card">
    <h2>{{ t('Claim a report by ID') }}</h2><p class="dialog-intro">{{ t('Use a report ID supplied by the site. Claiming requires a site contract and current terms acceptance; the service checks eligibility and availability.') }}</p>
    <form class="draft-form" @submit.prevent="claim"><fieldset class="report-fields" :disabled="busy"><label>{{ t('Report ID') }}<input v-model="reportId" type="number" min="1" step="1" required /></label><p v-if="error" role="alert" class="live-error">{{ t(error) }}</p><button type="submit" class="report-issue-button">{{ t(busy ? 'Saving…' : 'Claim report') }}</button></fieldset></form>
  </section>
</template>
