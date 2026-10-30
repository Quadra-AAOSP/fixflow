<script setup lang="ts">
import { useLocale } from '@/i18n';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useAuth } from '@/composables/useAuth';
import { sendTechnicianInvitations } from '@/services/technician';
import { errorMessage } from '@/services/api';
import type { Report } from '@/types/maintenance';
import type { TechnicianInvitationsSent } from '@/types/technician';
const { t } = useLocale();

const props = defineProps<{ report: Report; disabled?: boolean }>();
const emit = defineEmits<{ busy: [value: boolean] }>();
const { user } = useAuth();
const allowed = computed(() => ['admin', 'super_admin'].includes(user.value?.role ?? '') &&
  !['confirmed', 'resolved_pending_confirmation'].includes(props.report.status));
const reason = ref('');
const sent = ref<TechnicianInvitationsSent | null>(null);
const busy = ref(false);
const error = ref('');
let generation = 0;
onBeforeUnmount(() => { generation++; });
function reset() { generation++; reason.value = ''; sent.value = null; error.value = ''; }
watch([() => props.report.id, () => props.report.category, () => props.report.specialty, () => allowed.value, () => user.value?.id], reset);
async function send() {
  if (!allowed.value || busy.value || props.disabled || sent.value && !sent.value.hasNext) return;
  const current = generation;
  busy.value = true; emit('busy', true); error.value = '';
  try {
    const result = await sendTechnicianInvitations(props.report.id, reason.value, sent.value ? sent.value.page + 1 : 0);
    if (current === generation) sent.value = result;
  } catch (err) { if (current === generation) error.value = errorMessage(err); }
  finally { busy.value = false; emit('busy', false); }
}
</script>

<template>
  <section v-if="allowed" class="detail-section">
    <h2>{{ t("Invite technicians to the site") }}</h2>
    <p class="dialog-intro">{{ t("Invite matching technicians who do not yet have a contract with this site. Each action processes the next backend batch and avoids duplicate invitations.") }}</p>
    <p v-if="error" role="alert" class="live-error">{{ t(error) }}</p>
    <p v-if="sent" role="status" class="draft-notice">{{ t('Created {count} invitations from batch {batch}.', { count: sent.created, batch: sent.page + 1 }) }} {{ t(sent.hasNext ? 'More matching skill batches are available.' : 'No more matching skill batches remain.') }}</p>
    <form class="draft-form" @submit.prevent="send"><fieldset class="report-fields" :disabled="busy || disabled || !!sent && !sent.hasNext">
      <label>{{ t("Reason for the invitation") }}<textarea v-model="reason" required maxlength="1000" rows="3" :placeholder="t('Explain the trade needed without including personal or confidential report details.')" /></label>
      <button type="submit" class="report-issue-button">{{ t(busy ? 'Sending invitations…' : sent ? 'Send next invitation batch' : 'Send invitation batch') }}</button>
    </fieldset></form>
    <button v-if="sent && !sent.hasNext" class="text-action" type="button" :disabled="busy || disabled" @click="reset">{{ t("Start a new invitation pass") }}</button>
  </section>
</template>
