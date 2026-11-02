<script setup lang="ts">
import { useLocale } from '@/i18n';
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Plus } from '@lucide/vue';
import { useMaintenanceStore } from '@/stores/maintenance';
import { searchReports, type ReportFilter } from '@/utils/maintenance';
import ReportTable from '@/components/dashboard/ReportTable.vue';
const { t } = useLocale();
const data = useMaintenanceStore();
const route = useRoute();
const router = useRouter();
const filter = computed<ReportFilter>(() => ['open','progress','resolved','urgent'].includes(String(route.query.status)) ? route.query.status as ReportFilter : 'all');
const reports = computed(() => searchReports(data.reports, String(route.query.q || ''), data.siteName, filter.value).sort((a,b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)));
function setFilter(event: Event) { const value = (event.target as HTMLSelectElement).value; router.replace({ query: { ...route.query, status: value === 'all' ? undefined : value } }); }
</script>
<template>
  <section class="dashboard-card live-page"><div class="card-heading"><div><h1>{{ t("Reports") }}</h1><p>{{ data.selectedSite?.name }}</p></div><RouterLink v-if="data.canCreate && data.selectedSite" to="/reports/new" class="report-issue-button"><Plus :size="19" />{{ t("New report") }}</RouterLink></div>
    <div class="report-filters"><label>{{ t("Status") }} <select :value="filter" @change="setFilter"><option value="all">{{ t("All reports") }}</option><option value="open">{{ t("Open") }}</option><option value="progress">{{ t("In progress") }}</option><option value="resolved">{{ t("Resolved") }}</option><option value="urgent">{{ t("Urgent") }}</option></select></label><span v-if="data.reportsLoaded">{{ t('{count} matching reports', { count: reports.length }) }}</span><span v-if="route.query.q">{{ t('Search: {query}', { query: String(route.query.q) }) }} <RouterLink :to="{ query: { ...route.query, q: undefined } }" class="text-action">{{ t("Clear search") }}</RouterLink></span></div>
    <p v-if="data.loading" class="live-empty" role="status">{{ t("Loading reports…") }}</p><div v-else-if="data.reportsError" class="live-error" role="alert">{{ t(data.reportsError) }} <button @click="data.refresh()">{{ t("Retry") }}</button></div><ReportTable v-else-if="data.reportsLoaded" :reports="reports" /><p v-else class="live-empty">{{ t("Select an accessible site to view its reports.") }}</p>
  </section>
</template>
