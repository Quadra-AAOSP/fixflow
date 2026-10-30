<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useAuth } from '@/composables/useAuth';
import { classifyReport } from '@/services/maintenance';
import { errorMessage } from '@/services/api';
import { humanize, urgencyLabels } from '@/utils/maintenance';
import type { Report } from '@/types/maintenance';

const props = defineProps<{ report: Report; disabled?: boolean }>();
const emit = defineEmits<{ saved: [report: Report]; busy: [value: boolean] }>();
const { user } = useAuth();
const manager = computed(() => user.value?.role === 'admin' || user.value?.role === 'super_admin');
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
    <div class="card-heading"><h2>AI assessment</h2><button v-if="manager" type="button" class="text-action" :disabled="busy || disabled" @click="classify">{{ busy ? 'Classifying…' : 'Classify report' }}</button></div>
    <p class="dialog-intro">AI assessment is separate from the reporter’s description and urgency. Only details returned for your access level appear here.</p>
    <p v-if="error" role="alert" class="live-error">{{ error }}</p>
    <dl class="report-detail-grid"><div><dt>AI urgency</dt><dd>{{ report.aiReport?.urgency ? urgencyLabels[report.aiReport.urgency] : 'Not classified' }}</dd></div><div><dt>AI category</dt><dd>{{ report.aiReport?.category ? humanize(report.aiReport.category) : 'Not shared or not available' }}</dd></div><div><dt>AI specialty</dt><dd>{{ report.aiReport?.specialty ? humanize(report.aiReport.specialty) : 'Not shared or not available' }}</dd></div></dl>
    <h3>AI description</h3><p class="ai-assessment-copy">{{ report.aiReport?.description || 'Not shared or not available' }}</p>
    <h3>AI urgency reason</h3><p class="ai-assessment-copy">{{ report.aiReport?.urgencyReason || 'Not shared or not available' }}</p>
  </section>
</template>

<style scoped>
h3{margin-top:18px;font-weight:600;font-size:14px}.ai-assessment-copy{margin-top:8px;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.7;color:#536984}
</style>
