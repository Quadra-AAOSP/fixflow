<script setup lang="ts">
import LoadingStatus from '@/components/ui/LoadingStatus.vue';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useAuth } from '@/composables/useAuth';
import { useLocale } from '@/i18n';
import { errorMessage } from '@/services/api';
import { escalateWork, listRatings, listResolutions, resolveWork, startWork, submitRating, type ReportRating, type ReportResolution } from '@/services/reportWork';
import type { Report } from '@/types/maintenance';
import { formatDate } from '@/utils/maintenance';

const props = defineProps<{ report: Report; disabled?: boolean }>();
const emit = defineEmits<{ saved: [report: Report]; busy: [value: boolean] }>();
const { user } = useAuth();
const { t } = useLocale();
const assignee = computed(() => user.value?.role === 'technician' && user.value.id === props.report.assignedTechnicianId);
const operator = computed(() => ['admin', 'super_admin', 'staff'].includes(user.value?.role ?? ''));
const participant = computed(() => user.value?.role === 'reporter' && (user.value.id === props.report.createdByUserId || props.report.policy?.participant));
const canStart = computed(() => assignee.value && ['assigned', 'reopened', 'escalated'].includes(props.report.status));
const canResolve = computed(() => assignee.value && props.report.status === 'in_progress');
const canEscalate = computed(() => (assignee.value || operator.value && props.report.assignedTechnicianId !== null)
  && ['assigned', 'in_progress', 'reopened'].includes(props.report.status));
const canReadWork = computed(() => !!props.report.policy?.canSeeSensitive && (assignee.value || operator.value || participant.value));
const showOutcome = computed(() => canReadWork.value && ['resolved_pending_confirmation', 'confirmed'].includes(props.report.status));
const resolutions = ref<ReportResolution[]>([]);
const ratings = ref<ReportRating[]>([]);
const resolution = computed(() => resolutions.value.at(-1));
const canRate = computed(() => props.report.status === 'confirmed' && !!resolution.value
  && resolution.value.technicianId !== user.value?.id && (operator.value || participant.value)
  && !ratings.value.some(rating => rating.ratedByCurrentUser && rating.resolutionId === resolution.value?.id));
const description = defineModel<string>('description', { default: '' });
const concern = ref('');
const score = ref<number | null>(null);
const feedback = ref('');
const loading = ref(false);
const busy = ref(false);
const actionError = ref('');
const loadError = ref('');
let revision = 0;
let read: AbortController | undefined;

async function loadOutcome() {
  read?.abort();
  const request = new AbortController();
  read = request;
  loading.value = true;
  loadError.value = '';
  try {
    const result = await Promise.all([listResolutions(props.report.id, request.signal), listRatings(props.report.id, request.signal)]);
    if (!request.signal.aborted) [resolutions.value, ratings.value] = result;
  } catch (err) { if (!request.signal.aborted) loadError.value = errorMessage(err); }
  finally { if (!request.signal.aborted) loading.value = false; }
}

watch([() => props.report.id, () => user.value?.id, () => user.value?.role], () => {
  revision++;
  description.value = '';
  concern.value = '';
  score.value = null;
  feedback.value = '';
  actionError.value = '';
});
watch([() => props.report.id, () => props.report.status, () => user.value?.id, showOutcome], () => {
  read?.abort();
  resolutions.value = [];
  ratings.value = [];
  loadError.value = '';
  loading.value = false;
  if (showOutcome.value) void loadOutcome();
}, { immediate: true });
onBeforeUnmount(() => {
  revision++;
  read?.abort();
  if (busy.value) emit('busy', false);
});

async function save(change: () => Promise<void>) {
  if (busy.value || props.disabled) return;
  const current = revision;
  busy.value = true;
  emit('busy', true);
  actionError.value = '';
  try { await change(); }
  catch (err) { if (current === revision) actionError.value = errorMessage(err); }
  finally { busy.value = false; emit('busy', false); }
}

function transition(action: 'start' | 'resolve' | 'escalate') {
  if (action === 'start' && !canStart.value || action === 'resolve' && (!canResolve.value || !description.value.trim())
    || action === 'escalate' && (!canEscalate.value || !concern.value.trim())) return;
  const current = revision;
  const reportId = props.report.id;
  void save(async () => {
    const result = await (action === 'start' ? startWork(reportId)
      : action === 'resolve' ? resolveWork(reportId, description.value.trim()) : escalateWork(reportId, concern.value.trim()));
    if (current === revision) {
      description.value = '';
      concern.value = '';
      emit('saved', result);
    }
  });
}

function rate() {
  if (!canRate.value || !resolution.value || !score.value) return;
  const current = revision;
  const reportId = props.report.id;
  const draft = { resolutionId: resolution.value.id, score: score.value, feedback: feedback.value.trim() };
  void save(async () => {
    const result = await submitRating(reportId, draft);
    if (current === revision) {
      ratings.value.push({ ...result, ratedByCurrentUser: true });
      score.value = null;
      feedback.value = '';
    }
  });
}
</script>

<template>
  <section v-if="canStart || canResolve || canEscalate || showOutcome" class="detail-section">
    <h2>{{ t('Work and feedback') }}</h2>
    <p v-if="actionError" class="live-error" role="alert">{{ t(actionError) }}</p>
    <button v-if="canStart" class="report-issue-button" type="button" :disabled="busy || disabled" @click="transition('start')">{{ t('Start work') }}</button>
    <form v-if="canResolve" class="draft-form" @submit.prevent="transition('resolve')">
      <fieldset class="report-fields" :disabled="busy || disabled">
        <label>{{ t('Describe the completed work') }}<textarea v-model="description" rows="3" maxlength="10000" required /></label>
        <button class="report-issue-button" type="submit" :disabled="!description.trim()">{{ t('Submit resolution') }}</button>
      </fieldset>
    </form>
    <details v-if="canEscalate">
      <summary>{{ t('Raise a safety or work concern') }}</summary>
      <form class="draft-form" @submit.prevent="transition('escalate')">
        <fieldset class="report-fields" :disabled="busy || disabled">
          <label>{{ t('Concern details') }}<textarea v-model="concern" rows="3" maxlength="2000" required /></label>
          <button class="text-action" type="submit" :disabled="!concern.trim()">{{ t('Escalate report') }}</button>
        </fieldset>
      </form>
    </details>
    <template v-if="showOutcome">
      <LoadingStatus v-if="loading" :label="t('Loading work and feedback…')" />
      <p v-else-if="loadError" role="alert" class="live-error">{{ t(loadError) }} <button type="button" class="text-action" @click="loadOutcome">{{ t('Retry') }}</button></p>
      <template v-else>
        <article v-for="entry in resolutions" :key="entry.id" class="detail-section">
          <h3>{{ t('Resolution submitted {date}', { date: formatDate(entry.createdAt, true) }) }}</h3>
          <p class="work-description">{{ entry.description }}</p>
          <ul v-if="ratings.some(rating => rating.resolutionId === entry.id)">
            <li v-for="rating in ratings.filter(item => item.resolutionId === entry.id)" :key="rating.id" class="work-description">{{ t('Rating: {score} out of 5', { score: rating.score }) }}<span v-if="rating.feedback"> · {{ rating.feedback }}</span></li>
          </ul>
        </article>
        <form v-if="canRate" class="draft-form" @submit.prevent="rate">
          <fieldset class="report-fields" :disabled="busy || disabled">
            <label>{{ t('Rating (1–5)') }}<select v-model="score" required><option :value="null" disabled>{{ t('Select a rating') }}</option><option v-for="value in 5" :key="value" :value="value">{{ value }}</option></select></label>
            <label>{{ t('Feedback') }}<textarea v-model="feedback" rows="3" maxlength="2000" /></label>
            <button class="report-issue-button" type="submit" :disabled="!score">{{ t('Submit feedback') }}</button>
          </fieldset>
        </form>
      </template>
    </template>
  </section>
</template>

<style scoped>
.work-description { white-space: pre-wrap; overflow-wrap: anywhere; }
</style>
