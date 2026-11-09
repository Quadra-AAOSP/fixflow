<script setup lang="ts">
import { useLocale } from '@/i18n';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useAuth } from '@/composables/useAuth';
import { confirmReport, reopenReport } from '@/services/maintenance';
import { errorMessage } from '@/services/api';
import type { Report } from '@/types/maintenance';
const { t } = useLocale();

const props = defineProps<{ report: Report; disabled?: boolean }>();
const emit = defineEmits<{ saved: [report: Report]; busy: [value: boolean] }>();
const { user } = useAuth();
const allowed = computed(() => ['staff', 'admin', 'super_admin'].includes(user.value?.role ?? '') ||
  user.value?.role === 'reporter' && (props.report.createdByUserId === user.value.id || props.report.policy?.participant));
const reviewable = computed(() => allowed.value && ['resolved_pending_confirmation', 'confirmed'].includes(props.report.status));
const canConfirm = computed(() => props.report.createdByUserId === user.value?.id && user.value?.role !== 'technician');
const reason = ref('');
const signedName = ref('');
const busy = ref(false);
const error = ref('');
let generation = 0;
onBeforeUnmount(() => { generation++; });
watch(() => [props.report.id, user.value?.id, allowed.value], () => { generation++; reason.value = ''; error.value = ''; });
async function save(action: 'confirm' | 'reopen') {
  if (!reviewable.value || busy.value || props.disabled || action === 'confirm' && props.report.status !== 'resolved_pending_confirmation') return;
  const current = generation;
  busy.value = true; emit('busy', true); error.value = '';
  try {
    const saved = action === 'confirm' ? await confirmReport(props.report.id, signedName.value) : await reopenReport(props.report.id, reason.value);
    if (current === generation) { reason.value = ''; emit('saved', saved); }
  } catch (err) { if (current === generation) error.value = errorMessage(err); }
  finally { busy.value = false; emit('busy', false); }
}
</script>

<template>
  <section v-if="reviewable" class="detail-section">
    <h2>{{ t(report.status === 'confirmed' ? 'Issue confirmed' : 'Check the completed repair') }}</h2>
    <p v-if="report.status === 'resolved_pending_confirmation'" class="dialog-intro">{{ t("Confirm the issue is fixed after checking the repair. If it still needs attention, reopen it with a reason.") }}</p>
    <p v-else class="dialog-intro">{{ t("If the same issue returns, you can reopen this report and explain what still needs attention.") }}</p>
    <p v-if="error" role="alert" class="live-error">{{ t(error) }}</p>
    <label v-if="report.status === 'resolved_pending_confirmation' && canConfirm">{{ t("Your full name") }}<input v-model="signedName" maxlength="255" /></label>
    <button v-if="report.status === 'resolved_pending_confirmation' && canConfirm" type="button" class="report-issue-button" :disabled="busy || disabled || !signedName.trim()" @click="save('confirm')">{{ t(busy ? 'Saving…' : 'Confirm issue is fixed') }}</button>
    <form class="draft-form" @submit.prevent="save('reopen')"><fieldset class="report-fields" :disabled="busy || disabled"><label>{{ t("Why does this issue need more work?") }}<textarea v-model="reason" rows="3" maxlength="500" required /></label><button type="submit" class="text-action">{{ t(busy ? 'Saving…' : 'Reopen report') }}</button></fieldset></form>
  </section>
</template>
