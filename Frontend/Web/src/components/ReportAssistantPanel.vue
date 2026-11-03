<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useAuth } from '@/composables/useAuth';
import { useRealtimeStore } from '@/stores/realtime';
import { useLocale } from '@/i18n';
import { askReportAssistant, type AssistantTurn } from '@/services/reportAssistant';
import { errorMessage } from '@/services/api';
import type { Report } from '@/types/maintenance';
const props = defineProps<{ report: Report }>();
const { user } = useAuth();
const realtime = useRealtimeStore();
const { t } = useLocale();
const allowed = computed(() => {
  const actor = user.value;
  if (!actor) return false;
  if (actor.role === 'super_admin') return true;
  if (actor.siteId !== props.report.siteId) return false;
  if (actor.role === 'staff' || actor.role === 'admin') return true;
  if (actor.role === 'technician') return props.report.assignedTechnicianId === actor.id;
  return actor.role === 'reporter' && (props.report.createdByUserId === actor.id || props.report.policy?.participant === true);
});
const messages = ref<AssistantTurn[]>([]);
const question = ref('');
const consent = ref(false);
const busy = ref(false);
const error = ref('');
let generation = 0;
function clear() { generation++; messages.value = []; question.value = ''; consent.value = false; busy.value = false; error.value = ''; }
watch([() => props.report.id, () => user.value?.id, allowed, () => realtime.accessRevision], clear);
onBeforeUnmount(() => { generation++; });
async function send() {
  if (!allowed.value || !consent.value || busy.value || !question.value.trim()) return;
  const current = ++generation;
  // Keep at most nine completed exchanges plus the new user turn (backend max 20).
  const turns: AssistantTurn[] = [...messages.value.slice(-18), { role: 'user', content: question.value.trim() }];
  busy.value = true; error.value = '';
  try {
    const response = await askReportAssistant(props.report.id, turns);
    if (current !== generation) return;
    if (response.fallback) { error.value = 'The assistant is unavailable. Your question was not answered. Please try again.'; return; }
    messages.value = [...turns, { role: 'assistant', content: response.reply! }];
    question.value = '';
  } catch (err) { if (current === generation) error.value = errorMessage(err); }
  finally { if (current === generation) busy.value = false; }
}
</script>
<template>
  <section v-if="allowed" class="detail-section report-assistant">
    <h2>{{ t('Report assistant') }}</h2>
    <p class="dialog-intro">{{ t('Ask about this report. Answers may be inaccurate; use the recorded report status for decisions. Chat stays in this page and is cleared when access changes.') }}</p>
    <label class="assistant-consent"><input v-model="consent" type="checkbox" :disabled="busy" />{{ t('Send my question and authorized report context to the configured AI provider. Do not include personal or confidential information.') }}</label>
    <ol aria-live="polite" :aria-busy="busy" class="assistant-messages"><li v-for="(turn, index) in messages" :key="index"><strong>{{ t(turn.role === 'user' ? 'You' : 'Assistant') }}</strong><p>{{ turn.content }}</p></li></ol>
    <p v-if="error" class="live-error" role="alert">{{ t(error) }}</p>
    <form class="draft-form" @submit.prevent="send">
      <label>{{ t('Your question') }}<textarea v-model="question" required maxlength="2000" rows="3" :disabled="busy" /></label>
      <div class="assistant-actions"><button type="submit" class="report-issue-button" :disabled="busy || !consent || !question.trim()">{{ t(busy ? 'Sending…' : 'Ask assistant') }}</button><button type="button" class="text-action" @click="clear">{{ t('Clear chat') }}</button></div>
    </form>
  </section>
</template>
<style scoped>
.assistant-consent{display:flex;gap:10px;align-items:flex-start;font-size:12px;line-height:1.7}.assistant-consent input{margin-top:4px;flex-shrink:0}.assistant-messages{display:grid;gap:14px;margin:18px 0}.assistant-messages li{background:#f3f7f2;padding:14px;border-radius:10px;font-size:13px}.assistant-messages p{white-space:pre-wrap;overflow-wrap:anywhere;margin-top:6px;line-height:1.7}.assistant-actions{display:flex;flex-wrap:wrap;gap:16px;align-items:center}
</style>
