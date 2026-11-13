<script setup lang="ts">
import { useLocale } from '@/i18n';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useAuth } from '@/composables/useAuth';
import { enqueueReportVision, getLatestReportVisionJob, getReportVisionJob, validateVisionImage } from '@/services/reportVision';
import { errorMessage } from '@/services/api';
import type { Report, ReportVisionJob } from '@/types/maintenance';
const { t } = useLocale();

const props = defineProps<{ report: Report; disabled?: boolean }>();
const emit = defineEmits<{ finished: [reportId: number]; busy: [value: boolean]; updated: [job: ReportVisionJob | null] }>();
const { user } = useAuth();
const allowed = computed(() => ['staff', 'admin', 'super_admin'].includes(user.value?.role ?? '') ||
  user.value?.role === 'reporter' && props.report.createdByUserId === user.value.id);
const image = ref<File | null>(null);
const input = ref<HTMLInputElement>();
const consent = ref(false);
const uploading = ref(false);
const checking = ref(false);
const error = ref('');
const job = ref<ReportVisionJob | null>(null);
const pending = computed(() => !!job.value && ['queued', 'processing'].includes(job.value.status));
let timer: ReturnType<typeof setTimeout> | undefined;
let generation = 0;
function stop() { if (timer) clearTimeout(timer); timer = undefined; }
function publish(next: ReportVisionJob | null) {
  job.value = next;
  emit('updated', next);
}
function reset() {
  generation++; stop(); image.value = null; consent.value = false; error.value = ''; checking.value = false;
  if (input.value) input.value.value = '';
  publish(props.report.visionJob ?? null);
  if (pending.value) schedule();
  else if (allowed.value && !props.report.visionJob) void loadLatest();
}
async function loadLatest() {
  if (!allowed.value) return;
  const current = generation;
  try {
    const latest = await getLatestReportVisionJob(props.report.id);
    if (current !== generation) return;
    publish(latest);
    if (pending.value) schedule();
  } catch {
    if (current === generation) publish(null);
  }
}
onBeforeUnmount(() => { generation++; stop(); });
watch([() => props.report.id, () => props.report.visionJob?.jobId, () => props.report.visionJob?.status, () => user.value?.id, () => allowed.value], reset, { immediate: true });
function select(event: Event) {
  image.value = null; consent.value = false; error.value = '';
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try { validateVisionImage(file); image.value = file; }
  catch (err) { error.value = errorMessage(err); if (input.value) input.value.value = ''; }
}
function schedule() { stop(); if (pending.value) timer = setTimeout(() => { void check(); }, 3000); }
async function check() {
  if (!allowed.value || !pending.value || checking.value || !job.value) return;
  const current = generation;
  const id = job.value.jobId;
  checking.value = true; error.value = ''; stop();
  try {
    const result = await getReportVisionJob(props.report.id, id);
    if (current !== generation) return;
    if (result.reportId !== props.report.id || result.jobId !== id) throw new Error('The image job response did not match this report.');
    publish(result);
    if (pending.value) schedule(); else emit('finished', result.reportId);
  } catch (err) { if (current === generation) error.value = errorMessage(err); }
  finally { if (current === generation) checking.value = false; }
}
async function submit() {
  if (!allowed.value || props.report.status !== 'open' || uploading.value || props.disabled || pending.value || !image.value || !consent.value) return;
  const current = generation;
  uploading.value = true; emit('busy', true); error.value = '';
  try {
    const result = await enqueueReportVision(props.report.id, image.value, consent.value);
    if (current !== generation) return;
    if (result.reportId !== props.report.id) throw new Error('The image job response did not match this report.');
    publish(result); image.value = null; consent.value = false;
    if (input.value) input.value.value = '';
    if (pending.value) schedule(); else emit('finished', result.reportId);
  } catch (err) { if (current === generation) error.value = errorMessage(err); }
  finally { uploading.value = false; emit('busy', false); }
}
</script>

<template>
  <section v-if="allowed" class="detail-section">
    <h2>{{ t("Optional image analysis") }}</h2>
    <p class="dialog-intro">{{ t("Attaching a report photo already queues AI analysis when vision is enabled. Use this only to re-analyze with a different JPEG or PNG (up to 5 MiB, no more than 4096 pixels per side and 16 million pixels total).") }}</p>
    <p v-if="error" role="alert" class="live-error">{{ t(error) }}</p>
    <div v-if="job" class="draft-notice" role="status"><p>{{ t('Image analysis: {status}', { status: t(job.status.replaceAll('_', ' ')) }) }}<template v-if="job.model"> · {{ job.model }}</template></p><p v-if="job.status === 'stale'">{{ t("The report changed during processing. The outdated result was not applied.") }}</p><p v-if="job.status === 'review_required' || job.status === 'failed'">{{ t("An administrator should review this report; image analysis did not produce a completed assessment.") }}</p><p v-if="pending">{{ t("You can continue using the report while processing runs. If you leave this page, reload the report later to see any updated assessment.") }}</p><button v-if="pending" type="button" class="text-action" :disabled="checking" @click="check">{{ t(checking ? 'Checking…' : 'Check analysis status') }}</button></div>
    <details v-if="report.status === 'open' && !pending"><summary>{{ t("Analyze image with consent") }}</summary>
    <form v-if="report.status === 'open' && !pending" class="draft-form" @submit.prevent="submit"><fieldset class="report-fields" :disabled="uploading || disabled"><label>{{ t("Image for AI analysis") }}<input ref="input" type="file" accept="image/jpeg,image/png" @change="select" /></label><label class="consent-row"><input v-model="consent" type="checkbox" required /><span>{{ t("I consent to this image being processed by the configured AI provider. It contains no faces, personal information, or confidential information.") }}</span></label><button type="submit" class="report-issue-button" :disabled="!image || !consent">{{ t(uploading ? 'Submitting image…' : 'Analyze image with consent') }}</button></fieldset></form>
    </details>
    <p v-if="report.status !== 'open' && !job" class="dialog-intro">{{ t("New image analysis is available only while the report is open.") }}</p>
  </section>
</template>
