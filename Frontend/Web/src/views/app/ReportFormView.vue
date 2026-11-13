<script setup lang="ts">
import LoadingStatus from '@/components/ui/LoadingStatus.vue';
import { useLocale } from '@/i18n';
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowLeft, ArrowRight } from '@lucide/vue';
import { useAuth } from '@/composables/useAuth';
import { useMaintenanceStore } from '@/stores/maintenance';
import { createReport, createReportWithPhotos, listSubsites, requestSubsiteAddition } from '@/services/maintenance';
import { REPORT_PHOTO_LIMIT, REPORT_PHOTO_TYPES, validateReportPhoto } from '@/services/reportPhotos';
import { ApiError, errorMessage } from '@/services/api';
import { humanize, urgencyLabels } from '@/utils/maintenance';
import type { ReportVisibility, Subsite } from '@/types/maintenance';
import type { Urgency } from '@/types';
const { t } = useLocale();

const data = useMaintenanceStore();
const { user } = useAuth();
const router = useRouter();
const description = ref('');
const address = ref('');
const category = ref('');
const specialty = ref('');
const visibility = ref<ReportVisibility>('public');
const urgency = ref<Urgency | ''>('');
const reason = ref('');
const subsiteId = ref<number | null>(null);
const subsites = ref<Subsite[]>([]);
const locationsLoading = ref(false);
const locationsError = ref('');
const requestNote = ref('');
const showSuggestion = ref(false);
const suggestionInput = ref<HTMLTextAreaElement>();
async function openSuggestion() {
  showSuggestion.value = true;
  await nextTick();
  suggestionInput.value?.focus();
}
const requestBusy = ref(false);
const requestError = ref('');
const requestSent = ref(false);
const submitting = ref(false);
const error = ref('');
const photos = ref<File[]>([]);
const photoInput = ref<HTMLInputElement>();
const photoError = ref('');
function clearPhotos() {
  photos.value = []; photoError.value = '';
  if (photoInput.value) photoInput.value.value = '';
}
function selectPhotos(event: Event) {
  photos.value = []; photoError.value = '';
  const selected = Array.from((event.target as HTMLInputElement).files ?? []);
  try {
    if (selected.length > REPORT_PHOTO_LIMIT) throw new Error('Choose up to 1 photo.');
    selected.forEach(validateReportPhoto);
    photos.value = selected;
  } catch (err) {
    photoError.value = errorMessage(err);
    if (photoInput.value) photoInput.value.value = '';
  }
}
const categories = computed(() => [...new Set(data.rules.map(rule => rule.category))]);
const canManageBuildings = computed(() => user.value?.role === 'super_admin' || user.value?.role === 'admin');
let disposed = false;
let siteLoad = 0;
let suggestionVersion = 0;
onBeforeUnmount(() => { disposed = true; siteLoad++; suggestionVersion++; });

async function loadLocations(id: number | null, preserveSelection = false) {
  const current = ++siteLoad;
  const previousId = preserveSelection ? subsiteId.value : null;
  subsiteId.value = null; subsites.value = []; locationsError.value = ''; locationsLoading.value = false;
  if (!id) return;
  locationsLoading.value = true;
  try {
    const result = await listSubsites(id);
    if (current === siteLoad) {
      subsites.value = result.filter(item => !item.archivedAt);
      if (subsites.value.some(item => item.id === previousId)) subsiteId.value = previousId;
      else if (subsites.value.length === 1) subsiteId.value = subsites.value[0]!.id;
    }
  } catch (err) {
    if (current === siteLoad) locationsError.value = errorMessage(err);
  } finally {
    if (current === siteLoad) locationsLoading.value = false;
  }
}
watch(() => data.selectedSiteId, id => {
  clearPhotos(); suggestionVersion++; requestBusy.value = false;
  category.value = ''; error.value = ''; requestNote.value = ''; requestError.value = ''; requestSent.value = false; showSuggestion.value = false;
  void loadLocations(id);
}, { immediate: true });
watch(categories, values => { if (!values.includes(category.value)) category.value = ''; });

async function requestLocation() {
  const siteId = data.selectedSiteId;
  if (!siteId || requestBusy.value || !requestNote.value.trim()) return;
  const version = ++suggestionVersion;
  const note = requestNote.value.trim();
  requestError.value = '';
  requestBusy.value = true;
  try {
    await requestSubsiteAddition(siteId, note);
    if (!disposed && version === suggestionVersion && data.selectedSiteId === siteId) {
      requestSent.value = true;
      address.value = note.slice(0, 512);
      requestNote.value = '';
    }
  } catch (err) { if (!disposed && version === suggestionVersion && data.selectedSiteId === siteId) requestError.value = errorMessage(err); }
  finally { if (version === suggestionVersion) requestBusy.value = false; }
}

async function submit() {
  if (submitting.value || photoError.value) return;
  error.value = '';
  const siteId = data.selectedSiteId;
  if (!data.canCreate || !siteId || !description.value.trim() || !categories.value.includes(category.value) || !urgency.value ||
      !subsites.value.some(item => item.id === subsiteId.value)) {
    error.value = 'Choose a site, building, category, and urgency, and describe the issue.';
    return;
  }
  const payload = {
    siteId, subsiteId: subsiteId.value!, description: description.value.trim(),
    address: address.value.trim() || undefined, category: category.value,
    specialty: specialty.value.trim() || undefined, visibility: visibility.value,
    reporterUrgency: urgency.value, reporterReason: reason.value.trim() || undefined,
  };
  const actorId = user.value?.id;
  submitting.value = true;
  try {
    const report = photos.value.length ? await createReportWithPhotos(payload, photos.value) : await createReport(payload);
    if (disposed || user.value?.id !== actorId || data.selectedSiteId !== siteId) return;
    data.upsert(report);
    await router.replace({ name: 'report-detail', params: { id: report.id } });
  } catch (err) {
    if (disposed || user.value?.id !== actorId || data.selectedSiteId !== siteId) return;
    error.value = errorMessage(err);
    if (err instanceof ApiError && err.status === 409) await loadLocations(siteId);
  }
  finally { submitting.value = false; }
}
</script>

<template>
  <section class="dashboard-card live-page report-form-page">
    <RouterLink class="text-action" to="/reports"><ArrowLeft :size="16" />{{ t("All reports") }}</RouterLink>
    <h1>{{ t("Report an issue") }}</h1>
    <p class="dialog-intro">{{ t('Describe what needs attention at {site}. Your report will be saved to the maintenance system.', { site: data.selectedSite?.name || t('your site') }) }}</p>
    <p v-if="!data.canCreate" class="live-empty">{{ t("Your account cannot create reports.") }}</p>
    <LoadingStatus v-else-if="data.loading" :label="t('Loading site categories…')" />
    <p v-else-if="data.rulesError" class="live-error" role="alert">{{ t(data.rulesError) }} <button @click="data.refresh()">{{ t("Retry") }}</button></p>
    <p v-else-if="!data.selectedSite || !categories.length" class="live-empty">{{ t("No reporting categories are available for this site. Ask your administrator to configure them.") }}</p>
    <template v-else>
      <LoadingStatus v-if="locationsLoading" :label="t('Loading buildings…')" />
      <p v-else-if="locationsError" class="live-error" role="alert">{{ t(locationsError) }} <button type="button" @click="loadLocations(data.selectedSiteId)">{{ t("Retry") }}</button></p>
      <p v-else-if="!subsites.length" class="live-empty">{{ t("Reporting is not ready: a site admin must add a labelled building first.") }}
        <RouterLink v-if="canManageBuildings" :to="{ name: 'subsites', params: { siteId: data.selectedSiteId } }">{{ t("Set up buildings →") }}</RouterLink>
      </p>
      <form v-else class="draft-form" @submit.prevent="submit">
        <p v-if="error" role="alert" class="live-error">{{ t(error) }}</p>
        <fieldset :disabled="submitting" class="report-fields">
          <label>{{ t("What happened?") }}<textarea v-model="description" required maxlength="10000" rows="5" :placeholder="t('Describe the issue and what you noticed.')" /></label>
          <div class="form-two-columns">
            <div><label>{{ t("Building or location") }}<select v-model.number="subsiteId" required><option :value="null" disabled>{{ t("Choose a building") }}</option><option v-for="item in subsites" :key="item.id" :value="item.id">{{ item.label }} · {{ item.name }}</option></select></label><button type="button" class="text-action" aria-controls="building-suggestion" :aria-expanded="showSuggestion" @click="openSuggestion">{{ t("Can’t find your building?") }}</button></div>
            <label>{{ t("Room or exact spot (optional)") }}<input v-model="address" maxlength="512" :placeholder="t('Floor, room, or nearby landmark')" /></label>
          </div>
          <div class="form-two-columns">
            <label>{{ t("Category") }}<select v-model="category" required><option disabled value="">{{ t("Choose a category") }}</option><option v-for="item in categories" :key="item" :value="item">{{ t(humanize(item)) }}</option></select></label>
            <label>{{ t("Your urgency") }}<select v-model="urgency" required><option disabled value="">{{ t("Choose an urgency") }}</option><option v-for="(label, value) in urgencyLabels" :key="value" :value="value">{{ t(label) }}</option></select></label>
          </div>
          <label>{{ t('Specialty (optional)') }}<input v-model="specialty" maxlength="128" :placeholder="t('Specific trade or equipment, if known')" /></label>
          <label>{{ t('Report visibility') }}<select v-model="visibility" required><option value="public">{{ t('Public within your site') }}</option><option value="private">{{ t('Private report') }}</option></select></label>
          <p class="field-hint">{{ t(visibility === 'private' ? 'Private reports are restricted to the creator, attached reporters, authorized staff and admins, and the assigned technician.' : 'Other reporters at your site can browse and join this report. Your identity and exact address stay masked until they join.') }}</p>
          <label>{{ t("Why this urgency? (optional)") }}<textarea v-model="reason" rows="3" maxlength="2000" :placeholder="t('Explain how this issue affects the space.')" /></label>
          <label>{{ t("Photo (optional)") }}<input ref="photoInput" type="file" :accept="REPORT_PHOTO_TYPES.join(',')" @change="selectPhotos" /></label>
          <p class="field-hint">{{ t('One JPEG or PNG photo, up to 5 MiB. The photo is stored with the report and sent to AI analysis when available.') }}</p>
          <p v-if="photoError" class="live-error" role="alert">{{ t(photoError) }} {{ t('Choose again or clear the selection to continue.') }}</p>
          <ul v-if="photos.length"><li v-for="(photo, index) in photos" :key="index">{{ photo.name }}</li></ul>
          <button v-if="photos.length || photoError" type="button" class="text-action" @click="clearPhotos">{{ t("Clear photo selection") }}</button>
          <button class="report-issue-button" type="submit" :disabled="submitting || !!photoError">{{ t(submitting ? 'Submitting…' : 'Submit report') }}<ArrowRight :size="18" /></button>
        </fieldset>
      </form>
      <section id="building-suggestion" class="missing-location">
        <h2><button type="button" :aria-expanded="showSuggestion" aria-controls="building-suggestion-fields" @click="showSuggestion ? showSuggestion = false : openSuggestion()">{{ t("Suggest a missing building") }}</button></h2>
        <p>{{ t("Suggestions are reviewed by your site administrator. The suggested name is copied into the exact-location field; choose an approved building before submitting your report.") }}</p>
        <div v-if="showSuggestion" id="building-suggestion-fields">
        <div v-if="requestSent" role="status"><p>{{ t("Your request was sent to the site administrator.") }}</p><p>{{ t("You can suggest another building while earlier requests are still pending.") }}</p><p>{{ t("Once approved, refresh the building list and select it above.") }} <button type="button" class="text-action" :disabled="locationsLoading" @click="loadLocations(data.selectedSiteId, true)">{{ t("Refresh buildings") }}</button></p></div>
        <form class="draft-form" @submit.prevent="requestLocation">
          <p v-if="requestError" class="live-error" role="alert">{{ t(requestError) }}</p>
          <label>{{ t("Describe the missing location") }}<textarea ref="suggestionInput" v-model="requestNote" required maxlength="1000" rows="2" :placeholder="t('Building name or how to find it')" /></label>
          <button class="text-action" type="submit" :disabled="requestBusy || !requestNote.trim()">{{ t(requestBusy ? 'Sending…' : 'Request a new building →') }}</button>
        </form>
        </div>
      </section>
    </template>
  </section>
</template>

<style scoped>
.missing-location{border-top:1px solid #e8eeea;margin-top:26px;padding-top:22px}.missing-location h2{font-size:16px;font-weight:650}.missing-location p{font-size:12px;color:#62778a;margin:8px 0}.missing-location form{margin-top:12px}.missing-location .text-action{width:max-content}.report-form-page .live-empty a{color:#008e82;text-decoration:underline}
</style>
