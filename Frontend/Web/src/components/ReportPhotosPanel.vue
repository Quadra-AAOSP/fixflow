<script setup lang="ts">
import { useLocale } from '@/i18n';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useAuth } from '@/composables/useAuth';
import { errorMessage } from '@/services/api';
import { REPORT_PHOTO_LIMIT, REPORT_PHOTO_TYPES, listReportPhotos, uploadReportPhoto, removeReportPhoto, refreshReportPhotoUrl, validateReportPhoto, safePhotoUrl } from '@/services/reportPhotos';
import type { Report, ReportPhoto } from '@/types/maintenance';
const { t } = useLocale();

const props = defineProps<{ report: Report }>();
const { user } = useAuth();
const allowed = computed(() => ['staff', 'admin', 'super_admin'].includes(user.value?.role ?? '') ||
  (user.value?.role === 'reporter' && (props.report.createdByUserId === user.value.id || props.report.policy?.participant)));
const photos = ref<ReportPhoto[]>([]);
const file = ref<File | null>(null);
const input = ref<HTMLInputElement>();
const loading = ref(false);
const busy = ref(false);
const error = ref('');
const success = ref('');
const confirmingId = ref<number | null>(null);
const failedImages = ref<number[]>([]);
let generation = 0;
onBeforeUnmount(() => { generation++; });

async function load() {
  const current = ++generation;
  photos.value = []; file.value = null; error.value = ''; success.value = ''; confirmingId.value = null;
  failedImages.value = [];
  if (input.value) input.value.value = '';
  loading.value = false;
  if (!allowed.value) return;
  loading.value = true;
  try { const result = await listReportPhotos(props.report.id); if (current === generation) photos.value = result; }
  catch (err) { if (current === generation) error.value = errorMessage(err); }
  finally { if (current === generation) loading.value = false; }
}
watch(() => [props.report.id, allowed.value, user.value?.id], load, { immediate: true });

function select(event: Event) {
  error.value = ''; file.value = null;
  const selected = (event.target as HTMLInputElement).files?.[0];
  if (!selected) return;
  try { validateReportPhoto(selected); file.value = selected; }
  catch (err) { error.value = errorMessage(err); if (input.value) input.value.value = ''; }
}
async function upload() {
  if (!allowed.value || !file.value || loading.value || busy.value || photos.value.length >= REPORT_PHOTO_LIMIT) return;
  const current = generation;
  busy.value = true; error.value = ''; success.value = '';
  try {
    const saved = await uploadReportPhoto(props.report.id, file.value);
    if (current !== generation) return;
    photos.value.push(saved); file.value = null;
    if (input.value) input.value.value = '';
    success.value = 'Photo uploaded.';
  } catch (err) { if (current === generation) error.value = errorMessage(err); }
  finally { busy.value = false; }
}
async function remove(photoId: number) {
  if (!allowed.value || busy.value || confirmingId.value !== photoId) return;
  const current = generation;
  busy.value = true; error.value = ''; success.value = '';
  try {
    await removeReportPhoto(props.report.id, photoId);
    if (current !== generation) return;
    photos.value = photos.value.filter(item => item.id !== photoId); confirmingId.value = null;
    success.value = 'Photo removed.';
  } catch (err) { if (current === generation) error.value = errorMessage(err); }
  finally { busy.value = false; }
}
async function refreshUrl(item: ReportPhoto) {
  if (busy.value) return;
  const current = generation;
  busy.value = true; error.value = '';
  try {
    const result = await refreshReportPhotoUrl(props.report.id, item.id);
    if (current !== generation) return;
    item.url = result.url; failedImages.value = failedImages.value.filter(id => id !== item.id);
  } catch (err) { if (current === generation) error.value = errorMessage(err); }
  finally { busy.value = false; }
}
</script>

<template>
  <section v-if="allowed" class="detail-section">
    <div class="card-heading"><h2>{{ t("Report photos") }}</h2><button class="text-action" type="button" :disabled="loading || busy" @click="load">{{ t("Refresh photos") }}</button></div>
    <p class="dialog-intro">{{ t('Up to {limit} photos, 5 MiB each. Photos are shared with people authorized to access this report.', { limit: REPORT_PHOTO_LIMIT }) }}</p>
    <p v-if="error" class="live-error" role="alert">{{ t(error) }}</p><p v-if="success" class="draft-notice" role="status">{{ t(success) }}</p>
    <p v-if="loading" role="status">{{ t("Loading photos…") }}</p>
    <p v-else-if="!error && !photos.length">{{ t("No photos attached.") }}</p>
    <ul class="report-photo-grid"><li v-for="(item, index) in photos" :key="item.id">
      <img v-if="safePhotoUrl(item.url) && !failedImages.includes(item.id)" :src="safePhotoUrl(item.url)" :alt="t('Report photo {number}', { number: index + 1 })" loading="lazy" referrerpolicy="no-referrer" @error="failedImages.push(item.id)" />
      <p v-else>{{ t("Photo preview unavailable. Try refreshing its link.") }}</p>
      <a v-if="safePhotoUrl(item.url)" :href="safePhotoUrl(item.url)" target="_blank" rel="noopener noreferrer" class="text-action">{{ t('View or download photo {number} ↗', { number: index + 1 }) }}</a>
      <button type="button" class="text-action" :disabled="busy" @click="refreshUrl(item)">{{ t('Refresh photo {number} link', { number: index + 1 }) }}</button>
      <template v-if="confirmingId === item.id"><p>{{ t("Remove this photo permanently?") }}</p><button type="button" :disabled="busy" class="text-action" @click="remove(item.id)">{{ t("Confirm removal") }}</button><button type="button" :disabled="busy" class="text-action" @click="confirmingId = null">{{ t("Cancel") }}</button></template>
      <button v-else type="button" class="text-action" :disabled="busy" @click="confirmingId = item.id">{{ t('Remove photo {number}', { number: index + 1 }) }}</button>
    </li></ul>
    <form class="draft-form" @submit.prevent="upload"><fieldset class="report-fields" :disabled="loading || busy || photos.length >= REPORT_PHOTO_LIMIT">
      <label>{{ t("Add a photo") }}<input ref="input" type="file" :accept="REPORT_PHOTO_TYPES.join(',')" @change="select" /></label>
      <button type="submit" class="report-issue-button" :disabled="!file">{{ t(busy ? 'Saving…' : 'Upload photo') }}</button>
    </fieldset></form>
  </section>
</template>

<style scoped>
.report-photo-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin:16px 0}.report-photo-grid li{display:flex;flex-direction:column;align-items:flex-start;gap:10px;padding:14px;border:1px solid #e4ebe7;border-radius:12px;min-width:0}.report-photo-grid img{width:100%;height:180px;object-fit:contain;border-radius:8px}.report-photo-grid .text-action{text-align:left}
</style>
