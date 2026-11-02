<script setup lang="ts">
import { useLocale } from '@/i18n';
import { formatDate } from '@/utils/maintenance';
import { computed, onMounted, ref } from 'vue';
import { acceptTechnicianTerms, getTechnicianTerms } from '@/services/technician';
import { ApiError, errorMessage } from '@/services/api';
import type { TechnicianTermsStatus } from '@/types/technician';
const { t } = useLocale();

const emit = defineEmits<{ change: [status: TechnicianTermsStatus | null] }>();
const status = ref<TechnicianTermsStatus | null>(null);
const loading = ref(false);
const saving = ref(false);
const reviewed = ref(false);
const error = ref('');
const documentUrl = computed(() => {
  const value = status.value?.documentUrl;
  if (!value) return null;
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
});

async function refresh() {
  if (loading.value || saving.value) return;
  loading.value = true;
  reviewed.value = false;
  error.value = '';
  emit('change', null);
  try { status.value = await getTechnicianTerms(); emit('change', status.value); }
  catch (err) { status.value = null; error.value = errorMessage(err); }
  finally { loading.value = false; }
}

async function accept() {
  const version = status.value?.currentVersion;
  if (!version || !documentUrl.value || !reviewed.value || loading.value || saving.value) return;
  saving.value = true;
  error.value = '';
  let changed = false;
  try { status.value = await acceptTechnicianTerms(version); emit('change', status.value); }
  catch (err) { error.value = errorMessage(err); changed = err instanceof ApiError && err.status === 409; }
  finally { saving.value = false; }
  if (changed) {
    await refresh();
    if (!error.value) error.value = 'The terms changed. Review the current version before accepting.';
  }
}

defineExpose({ refresh });
onMounted(refresh);
</script>

<template>
  <section class="contract-choice" aria-labelledby="technician-terms-heading">
    <div class="card-heading"><h2 id="technician-terms-heading">{{ t("Technician terms") }}</h2><button class="text-action" type="button" :disabled="loading || saving" @click="refresh">{{ t("Refresh terms") }}</button></div>
    <p v-if="loading" role="status">{{ t("Loading current terms…") }}</p>
    <p v-if="error" role="alert" class="live-error">{{ t(error) }}</p>
    <template v-if="status && !loading">
      <p v-if="!status.currentVersion || !documentUrl">{{ t('Approved terms are not configured for review.') }} {{ t(status.enforcementRequired ? 'Contact the platform owner before requesting site work.' : 'Acceptance is not currently required by the service.') }}</p>
      <template v-else>
        <p>{{ t('Version {version} · {requirement}', { version: status.currentVersion, requirement: t(status.enforcementRequired ? 'Required before site work and contract requests' : 'Available for review') }) }}</p>
        <a :href="documentUrl" target="_blank" rel="noopener noreferrer" class="text-action">{{ t("Read the current terms ↗") }}</a>
        <p v-if="status.acceptedCurrentVersion" role="status">{{ t("You have accepted this version.") }}</p>
        <form v-else @submit.prevent="accept">
          <label class="consent-row"><input v-model="reviewed" type="checkbox" :disabled="saving" required /><span>{{ t('I have read and agree to version {version}.', { version: status.currentVersion }) }}</span></label>
          <button class="report-issue-button" type="submit" :disabled="saving || !reviewed">{{ t(saving ? 'Recording acceptance…' : 'Accept current terms') }}</button>
        </form>
      </template>
      <details v-if="status.acceptances.length"><summary>{{ t("Acceptance history") }}</summary><ul><li v-for="item in status.acceptances" :key="item.version">{{ t('Version {version} · {date}', { version: item.version, date: formatDate(item.acceptedAt, true) }) }}</li></ul></details>
    </template>
  </section>
</template>
