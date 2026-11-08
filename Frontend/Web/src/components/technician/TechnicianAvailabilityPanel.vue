<script setup lang="ts">
import LoadingStatus from '@/components/ui/LoadingStatus.vue';
import { useLocale } from '@/i18n';
import { onBeforeUnmount, ref, watch } from 'vue';
import { useAuth } from '@/composables/useAuth';
import { getTechnicianAvailability, setTechnicianAvailability } from '@/services/technician';
import { errorMessage } from '@/services/api';
import { formatDate } from '@/utils/maintenance';
import type { TechnicianAvailability } from '@/types/technician';
const { t } = useLocale();

const { user } = useAuth();
const availability = ref<TechnicianAvailability | null>(null);
const loading = ref(false);
const saving = ref(false);
const error = ref('');
let generation = 0;
onBeforeUnmount(() => { generation++; });
async function load() {
  const current = ++generation;
  availability.value = null; error.value = ''; loading.value = false;
  if (user.value?.role !== 'technician') return;
  loading.value = true;
  try { const result = await getTechnicianAvailability(); if (current === generation) availability.value = result; }
  catch (err) { if (current === generation) error.value = errorMessage(err); }
  finally { if (current === generation) loading.value = false; }
}
watch(() => [user.value?.id, user.value?.role], load, { immediate: true });
async function toggle() {
  if (!availability.value || user.value?.role !== 'technician' || loading.value || saving.value) return;
  const current = generation;
  saving.value = true; error.value = '';
  try {
    const result = await setTechnicianAvailability(availability.value.status === 'available' ? 'unavailable' : 'available');
    if (current === generation) availability.value = result;
  } catch (err) { if (current === generation) error.value = errorMessage(err); }
  finally { saving.value = false; }
}
</script>

<template>
  <section v-if="user?.role === 'technician'" class="dashboard-card availability-panel">
    <div class="card-heading"><h2>{{ t("Your availability") }}</h2><button type="button" class="text-action" :disabled="loading || saving" @click="load">{{ t("Refresh availability") }}</button></div>
    <p class="dialog-intro">{{ t("Available technicians can appear in matching site candidate lists when they have the required contract, skills, and terms acceptance. Changing availability does not change existing assignments.") }}</p>
    <LoadingStatus v-if="loading" :label="t('Loading availability…')" /><p v-if="error" role="alert" class="live-error">{{ t(error) }}</p>
    <template v-if="availability"><p role="status">{{ t("Current status:") }} <strong>{{ t(availability.status) }}</strong></p><button type="button" role="switch" :aria-label="t('Available for site work')" :aria-checked="availability.status === 'available'" :disabled="loading || saving" class="report-issue-button" @click="toggle">{{ t(saving ? 'Saving…' : availability.status === 'available' ? 'Set unavailable' : 'Set available') }}</button><p v-if="availability.updatedAt" class="dialog-intro">{{ t('Updated {date}', { date: formatDate(availability.updatedAt, true) }) }}</p></template>
  </section>
</template>

<style scoped>
.availability-panel{margin:18px 0}.availability-panel .report-issue-button{margin-top:12px}
</style>
