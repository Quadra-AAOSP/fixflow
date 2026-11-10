<script setup lang="ts">
import LoadingStatus from '@/components/ui/LoadingStatus.vue';
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuth } from '@/composables/useAuth';
import { useMaintenanceStore } from '@/stores/maintenance';
import { useLocale } from '@/i18n';
import * as api from '@/services/siteDetails';
import { errorMessage } from '@/services/api';
import { humanize } from '@/utils/maintenance';
import type { Site, SiteRule } from '@/types/maintenance';
const { t } = useLocale(); const { user } = useAuth(); const route = useRoute(); const router = useRouter(); const data = useMaintenanceStore();
const siteId = computed(() => Number(route.params.siteId));
const allowed = computed(() => user.value?.role === 'super_admin' ||
  ['reporter', 'staff', 'admin'].includes(user.value?.role ?? '') && user.value?.siteId === siteId.value);
const showPool = computed(() => allowed.value && ['staff', 'admin', 'super_admin'].includes(user.value?.role ?? ''));
const canManage = computed(() => allowed.value && ['admin', 'super_admin'].includes(user.value?.role ?? ''));
const site = ref<Site | null>(null); const setup = ref<api.ReportingSetup | null>(null); const taxonomy = ref<SiteRule[] | null>(null); const pool = ref<api.SiteTechnician[] | null>(null);
const loading = ref(false); const error = ref(''); const setupError = ref(''); const taxonomyError = ref(''); const poolError = ref('');
const removing = ref(false); const typedName = ref(''); const busy = ref(false); const removalError = ref(''); const confirmation = ref<HTMLElement>();
let generation = 0; onBeforeUnmount(() => generation++);
async function load() {
  const current = ++generation;
  site.value = null; setup.value = null; taxonomy.value = null; pool.value = null;
  loading.value = false; error.value = ''; setupError.value = ''; taxonomyError.value = ''; poolError.value = ''; removing.value = false; typedName.value = ''; removalError.value = ''; busy.value = false;
  if (!allowed.value || !Number.isSafeInteger(siteId.value) || siteId.value <= 0) { error.value = 'This site is not available to your account.'; return; }
  const id = siteId.value; loading.value = true;
  const results = await Promise.allSettled([api.getSite(id), api.getReportingSetup(id), api.getSiteTaxonomy(id), showPool.value ? api.getSiteTechnicians(id) : Promise.resolve(null)]);
  if (current !== generation) return;
  const [details, readiness, categories, technicians] = results;
  if (details.status === 'fulfilled' && details.value.id === id) site.value = details.value;
  else error.value = details.status === 'rejected' ? errorMessage(details.reason) : 'The site response did not match the requested site.';
  if (readiness.status === 'fulfilled' && readiness.value.siteId === id) setup.value = readiness.value;
  else setupError.value = readiness.status === 'rejected' ? errorMessage(readiness.reason) : 'The setup response did not match the requested site.';
  if (categories.status === 'fulfilled') taxonomy.value = categories.value; else taxonomyError.value = errorMessage(categories.reason);
  if (technicians.status === 'fulfilled') pool.value = technicians.value; else poolError.value = errorMessage(technicians.reason);
  loading.value = false;
}
watch([siteId, () => user.value?.id, () => user.value?.role, () => user.value?.siteId], load, { immediate: true });
async function askRemove() { removing.value = true; typedName.value = ''; removalError.value = ''; await nextTick(); confirmation.value?.focus(); }
async function remove() {
  if (busy.value || user.value?.role !== 'super_admin' || !site.value || typedName.value !== site.value.name) return;
  const current = generation; const id = site.value.id; busy.value = true; removalError.value = '';
  try {
    await api.deleteSite(id); if (current !== generation) return;
    await data.refresh(); if (current === generation) await router.replace('/sites');
  } catch (err) { if (current === generation) removalError.value = errorMessage(err); }
  finally { if (current === generation) busy.value = false; }
}
</script>
<template>
  <section class="dashboard-card live-page site-details">
    <div class="card-heading"><RouterLink to="/sites" class="text-action">{{ t('Your Sites') }}</RouterLink><button class="text-action" type="button" :disabled="loading || busy" @click="load">{{ t('Refresh') }}</button></div>
    <LoadingStatus v-if="loading" :label="t('Loading site details…')" />
    <p v-else-if="error" class="live-error" role="alert">{{ t(error) }}</p>
    <template v-else-if="site">
      <h1>{{ site.name }}</h1><p>{{ site.description || t('No description provided.') }}</p><p>{{ site.address || t('No address provided.') }}</p>
      <dl class="report-detail-grid"><div><dt>{{ t('Site type') }}</dt><dd>{{ t(humanize(site.type)) }}</dd></div><div v-if="user?.role !== 'reporter'"><dt>{{ t('Contract status') }}</dt><dd>{{ t(humanize(site.contractStatus)) }}</dd></div></dl>
      <section class="detail-section"><h2>{{ t('Reporting readiness') }}</h2><p v-if="setupError" class="live-error" role="alert">{{ t(setupError) }}</p><template v-else-if="setup"><p>{{ t(setup.reportingReady ? 'Buildings are ready for reporting.' : 'A labelled building is required before reporting.') }}</p><p>{{ t('{count} active buildings', { count: setup.activeSubsiteCount }) }}</p></template><RouterLink class="text-action" :to="{ name: 'subsites', params: { siteId: site.id } }">{{ t(canManage ? 'Manage buildings →' : 'View buildings →') }}</RouterLink></section>
      <section class="detail-section"><h2>{{ t('Reporting categories') }}</h2><p v-if="taxonomyError" class="live-error" role="alert">{{ t(taxonomyError) }}</p><ul v-else-if="taxonomy?.length"><li v-for="rule in taxonomy" :key="rule.id">{{ t(humanize(rule.category)) }}</li></ul><p v-else>{{ t('No reporting categories are configured.') }}</p><RouterLink v-if="canManage" to="/site-rules" class="text-action">{{ t('Site rules') }}</RouterLink></section>
      <section v-if="showPool" class="detail-section"><h2>{{ t('Available technician pool') }}</h2><p class="dialog-intro">{{ t('This is the site-level availability pool. Report assignment still checks the report’s contract and specialty requirements.') }}</p><p v-if="poolError" class="live-error" role="alert">{{ t(poolError) }}</p><ul v-else-if="pool?.length" class="pool-list"><li v-for="person in pool" :key="person.technicianId"><strong>{{ person.firstName }} {{ person.lastName }}</strong><span>{{ person.email }}</span><span>{{ t('Technician #{id}', { id: person.technicianId }) }} · {{ t(humanize(person.availability)) }} · {{ t(person.contracted ? 'Contracted' : 'Uncontracted') }}</span></li></ul><p v-else>{{ t('No available technicians in this site pool.') }}</p></section>
      <section v-if="user?.role === 'super_admin'" class="detail-section"><h2>{{ t('Delete site') }}</h2><button v-if="!removing" class="text-action" type="button" @click="askRemove">{{ t('Review site deletion') }}</button><section v-else ref="confirmation" tabindex="-1" class="site-removal" :aria-label="t('Delete site confirmation')"><p>{{ t('Permanently delete {name}? This cannot be undone. The server may refuse deletion while related records exist.', { name: site.name }) }}</p><form class="draft-form" @submit.prevent="remove"><p v-if="removalError" class="live-error" role="alert">{{ t(removalError) }}</p><fieldset class="report-fields" :disabled="busy"><label>{{ t('Type the exact site name to confirm') }}<input v-model="typedName" required autocomplete="off" /></label><div class="site-removal-actions"><button class="text-action" type="submit" :disabled="typedName !== site.name">{{ t(busy ? 'Deleting…' : 'Delete site permanently') }}</button><button type="button" class="text-action" @click="removing = false">{{ t('Cancel') }}</button></div></fieldset></form></section></section>
    </template>
  </section>
</template>
<style scoped>
.site-details>p{font-size:14px;line-height:1.8;margin:12px 0}.pool-list{display:grid;gap:12px;margin-top:16px}.pool-list li{display:grid;gap:6px;border:1px solid #dce7df;border-radius:10px;padding:16px;font-size:13px;overflow-wrap:anywhere}.site-removal{border:1px solid #e2b7b7;background:#fff8f5;border-radius:10px;padding:20px;font-size:13px;line-height:1.8}.site-removal-actions{display:flex;gap:18px;flex-wrap:wrap}
</style>
