<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { useAuth } from '@/composables/useAuth';
import { useLocale } from '@/i18n';
import { errorMessage } from '@/services/api';
import { publishMarketplaceJob } from '@/services/marketplace';
import type { Report } from '@/types/maintenance';

const props = defineProps<{ report: Report; disabled?: boolean }>();
const emit = defineEmits<{ busy: [value: boolean] }>();
const { user } = useAuth();
const { t } = useLocale();
const eligible = computed(() => {
  const role = user.value?.role;
  const siteOk =
    role === 'super_admin' ||
    (role === 'admin' && user.value?.siteId === props.report.siteId);
  return (
    !!siteOk &&
    props.report.assignedTechnicianId === null &&
    ['open', 'routed', 'reopened', 'escalated'].includes(props.report.status)
  );
});
const draft = reactive({ summary: '', broadLocation: '', timing: '', amount: '' });
const confirmed = ref(false);
const published = ref(false);
const busy = ref(false);
const error = ref('');
let revision = 0;
watch([() => props.report.id, () => user.value?.id], () => {
  revision++;
  Object.assign(draft, { summary: '', broadLocation: '', timing: '', amount: '' });
  confirmed.value = false;
  published.value = false;
  error.value = '';
});
onBeforeUnmount(() => {
  revision++;
  if (busy.value) emit('busy', false);
});

async function publish() {
  const amountMinor = Math.round(Number(draft.amount) * 100);
  if (!eligible.value || !confirmed.value || busy.value || props.disabled || published.value
    || !draft.summary.trim() || !draft.broadLocation.trim() || !draft.timing.trim()
    || !Number.isFinite(amountMinor) || amountMinor <= 0) return;
  const current = revision;
  busy.value = true;
  emit('busy', true);
  error.value = '';
  try {
    await publishMarketplaceJob({
      reportId: props.report.id,
      summary: draft.summary.trim(),
      broadLocation: draft.broadLocation.trim(),
      timing: draft.timing.trim(),
      amountMinor,
      currency: 'USD',
    });
    if (current === revision) published.value = true;
  } catch (err) { if (current === revision) error.value = errorMessage(err); }
  finally { busy.value = false; emit('busy', false); }
}
</script>

<template>
  <section v-if="eligible" class="detail-section">
    <h2>{{ t('Publish to the job marketplace') }}</h2>
    <p class="dialog-intro">{{ t('Use a general description and broad area. Leave out names, exact addresses, building or room details, access instructions and other private information.') }}</p>
    <p v-if="error" role="alert" class="live-error">{{ t(error) }}</p>
    <p v-if="published" role="status" class="draft-notice">{{ t('The job listing is published.') }}</p>
    <form v-else class="draft-form" @submit.prevent="publish">
      <fieldset class="report-fields" :disabled="busy || disabled">
        <label>{{ t('Public job summary') }}<textarea v-model="draft.summary" rows="3" maxlength="300" required /></label>
        <label>{{ t('Broad location') }}<input v-model="draft.broadLocation" maxlength="160" required /></label>
        <label>{{ t('Expected timing') }}<input v-model="draft.timing" maxlength="160" required /></label>
        <label>{{ t('Pay amount') }}<input v-model="draft.amount" type="number" min="0.01" step="0.01" required /></label>
        <label class="privacy-check"><input v-model="confirmed" type="checkbox" required /> {{ t('I checked that this listing contains no private details.') }}</label>
        <button type="submit" class="report-issue-button" :disabled="!confirmed">{{ t(busy ? 'Saving…' : 'Publish job listing') }}</button>
      </fieldset>
    </form>
    <RouterLink class="text-action" to="/marketplace">{{ t('Manage marketplace listings') }}</RouterLink>
  </section>
</template>

<style scoped>
.privacy-check { display: flex; align-items: center; gap: .5rem; }
.privacy-check input { width: auto; }
</style>
