<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowLeft, ArrowRight } from '@lucide/vue';
import { useAuth } from '@/composables/useAuth';
import { useMaintenanceStore } from '@/stores/maintenance';
import { createReport } from '@/services/maintenance';
import { errorMessage } from '@/services/api';
import { humanize, urgencyLabels } from '@/utils/maintenance';
import type { Urgency } from '@/types';

const data = useMaintenanceStore();
const { user } = useAuth();
let disposed = false;
onBeforeUnmount(() => { disposed = true; });
const router = useRouter();
const description = ref('');
const address = ref('');
const category = ref('');
const urgency = ref<Urgency | ''>('');
const reason = ref('');
const submitting = ref(false);
const error = ref('');
const categories = computed(() => [...new Set(data.rules.map(rule => rule.category))]);
watch(() => data.selectedSiteId, () => { category.value = ''; error.value = ''; });
watch(categories, values => { if (!values.includes(category.value)) category.value = ''; });
async function submit() {
  if (submitting.value) return;
  error.value = '';
  if (!data.canCreate || !data.selectedSiteId || !description.value.trim() || !categories.value.includes(category.value) || !urgency.value) {
    error.value = 'Choose a site, category, and urgency, and describe the issue.'; return;
  }
  const payload = { siteId: data.selectedSiteId, description: description.value.trim(), address: address.value.trim() || undefined, category: category.value, reporterUrgency: urgency.value, reporterReason: reason.value.trim() || undefined };
  const actorId = user.value?.id;
  submitting.value = true;
  try {
    const report = await createReport(payload);
    if (disposed || user.value?.id !== actorId) return;
    data.upsert(report);
    await router.replace({ name: 'report-detail', params: { id: report.id } });
  } catch (err) { error.value = errorMessage(err); }
  finally { submitting.value = false; }
}
</script>
<template>
  <section class="dashboard-card live-page report-form-page"><RouterLink class="text-action" to="/reports"><ArrowLeft :size="16" />All reports</RouterLink><h1>Report an issue</h1><p class="dialog-intro">Describe what needs attention at {{ data.selectedSite?.name || 'your site' }}. Your report will be saved to the maintenance system.</p>
    <p v-if="!data.canCreate" class="live-empty">Your account cannot create reports.</p><p v-else-if="data.loading" class="live-empty">Loading site categories…</p><div v-else-if="data.rulesError" class="live-error" role="alert">{{ data.rulesError }} <button @click="data.refresh()">Retry</button></div><p v-else-if="!data.selectedSite || !categories.length" class="live-empty">No reporting categories are available for this site. Ask your administrator to configure them.</p>
    <form v-else class="draft-form" @submit.prevent="submit"><p v-if="error" role="alert" class="live-error">{{ error }}</p><fieldset :disabled="submitting" class="report-fields"><label>What happened?<textarea v-model="description" required rows="5" placeholder="Describe the issue and what you noticed." /></label><label>Location (optional)<input v-model="address" maxlength="512" placeholder="Building, floor, or room" /></label><div class="form-two-columns"><label>Category<select v-model="category" required><option disabled value="">Choose a category</option><option v-for="item in categories" :key="item" :value="item">{{ humanize(item) }}</option></select></label><label>Your urgency<select v-model="urgency" required><option disabled value="">Choose an urgency</option><option v-for="(label, value) in urgencyLabels" :key="value" :value="value">{{ label }}</option></select></label></div><label>Why this urgency? (optional)<textarea v-model="reason" rows="3" placeholder="Explain how this issue affects the space." /></label><button class="report-issue-button" type="submit" :disabled="submitting">{{ submitting ? 'Submitting…' : 'Submit report' }}<ArrowRight :size="18" /></button></fieldset></form>
  </section>
</template>
