<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useMaintenanceStore } from '@/stores/maintenance';
import { requestSubsiteAddition } from '@/services/maintenance';
import { errorMessage } from '@/services/api';
import { useLocale } from '@/i18n';
const { t } = useLocale();
const auth = useAuthStore(); const data = useMaintenanceStore();
const site = computed(() => data.sites.find(item => item.id === auth.user?.siteId));
const note = ref(''); const busy = ref(false); const error = ref('');
const receipts = ref<Array<{ id: number; siteId: number; status: string; note: string }>>([]);
let generation = 0; onBeforeUnmount(() => generation++);
async function submit() {
  if (busy.value || !auth.user?.siteId || !note.value.trim()) return;
  const current = generation; const description = note.value.trim();
  busy.value = true; error.value = '';
  try {
    const result = await requestSubsiteAddition(auth.user.siteId, description);
    if (current !== generation) return;
    receipts.value.unshift({ ...result, note: description }); note.value = '';
  } catch (err) { if (current === generation) error.value = errorMessage(err); }
  finally { if (current === generation) busy.value = false; }
}
</script>
<template>
  <section class="live-page suggestions-page">
    <h1>{{ t('My building suggestions') }}</h1>
    <p>{{ t('Tell your site administrator about a building missing from the report form.') }}</p>
    <section class="dashboard-card"><h2>{{ t('Suggest a building') }}</h2>
      <p>{{ site?.name || t('Your account site') }}</p>
      <form @submit.prevent="submit"><fieldset :disabled="busy || !auth.user?.siteId"><label>{{ t('Missing building details') }}<textarea v-model="note" required maxlength="1000" rows="4" /></label><p v-if="error" role="alert" class="live-error">{{ t(error) }}</p><button class="report-issue-button" type="submit" :disabled="!note.trim()">{{ t(busy ? 'Saving…' : 'Submit suggestion') }}</button></fieldset></form>
      <p class="dialog-intro">{{ t('The current backend allows only one pending suggestion per site. Multiple pending suggestions require the backend update requested from the team.') }}</p>
    </section>
    <section class="dashboard-card"><h2>{{ t('My request history') }}</h2><p role="status">{{ t('Your full suggestion history is awaiting a reporter-accessible backend endpoint. Requests are saved by the service; this page cannot retrieve earlier requests yet.') }}</p></section>
    <section v-if="receipts.length" class="dashboard-card"><h2>{{ t('Submitted this visit') }}</h2><p>{{ t('These are submission receipts from this visit, not your full request history.') }}</p><ul><li v-for="item in receipts" :key="item.id"><strong>#{{ item.id }} · {{ t(item.status) }}</strong><p>{{ item.note }}</p></li></ul></section>
  </section>
</template>
<style scoped>
.suggestions-page{display:grid;gap:20px;max-width:900px}.suggestions-page h1{font-size:28px;font-weight:700}.suggestions-page h2{font-size:19px;font-weight:650;margin-bottom:12px}.suggestions-page p{line-height:1.7}.suggestions-page label{display:grid;gap:8px}.suggestions-page textarea{width:100%;padding:14px;border:1px solid #b6c8bf;border-radius:10px;margin:10px 0}.suggestions-page li{padding:14px 0;border-bottom:1px solid #dce7df;overflow-wrap:anywhere}
</style>
