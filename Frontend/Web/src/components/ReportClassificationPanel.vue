<script setup lang="ts">
import { useLocale } from '@/i18n';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useAuth } from '@/composables/useAuth';
import { classifyReport } from '@/services/maintenance';
import { errorMessage } from '@/services/api';
import { humanize, urgencyLabels } from '@/utils/maintenance';
import type { Report } from '@/types/maintenance';
const { t } = useLocale();

const props = defineProps<{ report: Report; disabled?: boolean }>();
const emit = defineEmits<{ saved: [report: Report]; busy: [value: boolean] }>();
const { user } = useAuth();
const manager = computed(() => user.value?.role === 'admin' || user.value?.role === 'super_admin');
const detailsAllowed = computed(() => manager.value || user.value?.role === 'staff');
const busy = ref(false);
const error = ref('');
let generation = 0;
onBeforeUnmount(() => { generation++; });
watch(() => [props.report.id, user.value?.id, manager.value], () => { generation++; error.value = ''; });
async function classify() {
  if (!manager.value || props.disabled || busy.value) return;
  const current = generation;
  busy.value = true; emit('busy', true); error.value = '';
  try { const saved = await classifyReport(props.report.id); if (current === generation) emit('saved', saved); }
  catch (err) { if (current === generation) error.value = errorMessage(err); }
  finally { busy.value = false; emit('busy', false); }
}
</script>

<template>
  <section class="detail-section">
    <div class="card-heading"><h2>{{ t("AI assessment") }}</h2><button v-if="manager" type="button" class="text-action" :disabled="busy || disabled" @click="classify">{{ t(busy ? 'Classifying…' : 'Classify report') }}</button></div>
    <p class="dialog-intro">{{ t(detailsAllowed ? "AI classification uses the report description, address, site type and allowed categories. Fields marked not returned are missing from the service response; they are not inferred from the urgency." : "AI urgency is shared with your role. AI category, specialty, description and reasoning are restricted to site staff and administrators.") }}</p>
    <p v-if="error" role="alert" class="live-error">{{ t(error) }}</p>
    <dl class="report-detail-grid"><div><dt>{{ t("AI urgency") }}</dt><dd>{{ report.aiReport?.urgency ? t(urgencyLabels[report.aiReport.urgency]) : t('Not classified') }}</dd></div><div><dt>{{ t("AI category") }}</dt><dd>{{ report.aiReport?.category ? t(humanize(report.aiReport.category)) : t(detailsAllowed ? 'Not returned by the service' : 'Restricted to site staff and administrators') }}</dd></div><div><dt>{{ t("AI specialty") }}</dt><dd>{{ report.aiReport?.specialty ? t(humanize(report.aiReport.specialty)) : t(detailsAllowed ? 'Not returned by the service' : 'Restricted to site staff and administrators') }}</dd></div></dl>
    <h3>{{ t("AI description") }}</h3><p class="ai-assessment-copy">{{ report.aiReport?.description || t(detailsAllowed ? 'Not returned by the service' : 'Restricted to site staff and administrators') }}</p>
    <h3>{{ t("AI urgency reason") }}</h3><p class="ai-assessment-copy">{{ report.aiReport?.urgencyReason || t(detailsAllowed ? 'Not returned by the service' : 'Restricted to site staff and administrators') }}</p>
  </section>
</template>

<style scoped>
h3{margin-top:18px;font-weight:600;font-size:14px}.ai-assessment-copy{margin-top:8px;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.7;color:#536984}
</style>
