<script setup lang="ts">
import LoadingStatus from '@/components/ui/LoadingStatus.vue';
import { useLocale } from '@/i18n';
import { computed, ref } from 'vue';
import { ArrowRight, Plus, FileText, Settings, CircleCheck, TriangleAlert, Leaf, Heart, Users, Activity, RefreshCw } from '@lucide/vue';
import { useAuth } from '@/composables/useAuth';
import { useMaintenanceStore } from '@/stores/maintenance';
import { summarize, weeklyChart, matchesFilter, statusLabels, statusTone, formatDate, type ReportFilter } from '@/utils/maintenance';
import PlantArt from '@/components/dashboard/PlantArt.vue';
import ReportTable from '@/components/dashboard/ReportTable.vue';
const { t } = useLocale();

const { user } = useAuth();
const data = useMaintenanceStore();
const period = ref(0);
const activeStatus = ref<ReportFilter>('all');
const counts = computed(() => summarize(data.reports));
const stats = computed(() => [
  { label: 'Open Reports', value: counts.value.open, status: 'open' as const, tone: 'coral', icon: FileText, note: 'Open, routed, reopened, escalated' },
  { label: 'In Progress', value: counts.value.progress, status: 'progress' as const, tone: 'mint', icon: Settings, note: 'Assigned and in progress' },
  { label: 'Resolved', value: counts.value.resolved, status: 'resolved' as const, tone: 'citron', icon: CircleCheck, note: 'Awaiting confirmation or confirmed' },
  { label: 'Urgent', value: counts.value.urgent, status: 'urgent' as const, tone: 'coral', icon: TriangleAlert, note: 'Active high or critical urgency' },
]);
const chart = computed(() => weeklyChart(data.reports, period.value));
const chartMax = computed(() => Math.max(1, ...chart.value.flatMap(day => day.values)));
const recent = computed(() => [...data.reports].filter(report => matchesFilter(report, activeStatus.value)).sort((a,b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 3));
const updates = computed(() => [...data.reports].sort((a,b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, 4));
const chartDescription = computed(() => chart.value.map(day => t('{date}: {open} open, {progress} in progress, {resolved} resolved', { date: formatDate(day.date.toISOString()), open: day.values[0]!, progress: day.values[1]!, resolved: day.values[2]! })).join('; '));
const greeting = computed(() => new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening');
</script>

<template>
  <p v-if="data.reportsLoaded && data.reportPage + 1 < data.totalReportPages" class="dialog-intro">{{ t("Report counts and results cover loaded reports. Open Reports to load more.") }} <RouterLink to="/reports">{{ t("Reports") }}</RouterLink></p>
  <div class="home-dashboard">
    <section class="welcome-banner"><div class="welcome-copy"><h1>{{ user?.firstName ? t('{greeting}, {name}', { greeting: t(greeting), name: user.firstName }) : t(greeting) }}</h1><p>{{ t("Let’s keep every space working beautifully.") }}</p><div class="welcome-values"><span><Leaf :size="18" />{{ t("Safe spaces") }}</span><span><Heart :size="18" fill="currentColor" />{{ t("Happy people") }}</span><span><Users :size="19" />{{ t("Stronger communities") }}</span></div></div><div class="welcome-art"><PlantArt /><span>{{ t('Small fixes make a big difference.') }}<i /></span></div><RouterLink v-if="data.canCreate && data.selectedSite" class="report-issue-button" to="/reports/new"><span><Plus :size="21" /></span>{{ t("Report an Issue") }}</RouterLink></section>
    <div class="preview-label"><span>{{ data.selectedSite?.name || t('Your maintenance overview') }}</span><span>{{ t("YOUR COMMUNITY AT A GLANCE") }}</span></div>
    <div v-if="data.reportsError" class="live-error" role="alert">{{ t('Reports could not be loaded: {error}', { error: t(data.reportsError) }) }} <button @click="data.refresh()">{{ t("Retry") }}</button></div>
    <section class="stat-grid" :aria-label="t('Report statistics')"><button v-for="stat in stats" :key="stat.label" class="stat-card" :class="{ 'stat-selected': activeStatus === stat.status }" :aria-pressed="activeStatus === stat.status" :disabled="!data.reportsLoaded" :title="t(stat.note)" @click="activeStatus = activeStatus === stat.status ? 'all' : stat.status"><span class="stat-icon" :class="stat.tone"><component :is="stat.icon" :size="29" :stroke-width="1.7" /></span><span class="stat-content"><span>{{ t(stat.label) }}</span><strong>{{ data.reportsLoaded ? stat.value : '—' }}</strong><small>{{ t(data.loading ? 'Loading…' : 'Current site reports') }}</small></span></button></section>
    <div class="dashboard-columns"><div class="dashboard-primary">
      <section class="dashboard-card overview-card"><div class="card-heading"><div><h2>{{ t("Maintenance Overview") }}</h2><p>{{ t(period === 0 ? 'Reports created this week, grouped by current status' : 'Reports created last week, grouped by current status') }}</p></div><select v-model="period" :aria-label="t('Chart period')"><option :value="0">{{ t("This week") }}</option><option :value="-1">{{ t("Last week") }}</option></select></div>
        <template v-if="data.reportsLoaded"><div class="bar-chart" role="img" :aria-label="chartDescription"><div class="chart-y-axis"><span>{{ chartMax }}</span><span>0</span></div><div class="chart-plot"><div class="chart-grid-lines"><i /><i /></div><div v-for="day in chart" :key="day.date.toISOString()" class="chart-day"><div class="chart-bars"><div v-for="(value, index) in day.values" :key="index" class="chart-bar" :class="['coral','mint','citron'][index]" :style="{ height: `${value / chartMax * 100}%`, minHeight: value ? '2px' : '0' }"><span>{{ value }}</span></div></div><span class="day-label">{{ day.label }}</span></div></div></div><div class="chart-legend"><span><i class="coral" />{{ t("Open") }}</span><span><i class="mint" />{{ t("In Progress") }}</span><span><i class="citron" />{{ t("Resolved") }}</span></div><p v-if="chart.every(day => day.values.every(value => value === 0))" class="chart-empty">{{ t("No reports were created during this week.") }}</p></template><LoadingStatus v-else-if="data.loading" :label="t('Loading report data…')" /><p v-else class="live-empty">{{ t('Report data is unavailable.') }}</p>
      </section>
      <section class="dashboard-card reports-card"><div class="card-heading"><h2>{{ t("Recent Reports") }}</h2><RouterLink :to="{ name: 'reports', query: activeStatus === 'all' ? {} : { status: activeStatus } }" class="text-action">{{ t("View all") }} <ArrowRight :size="15" /></RouterLink></div><div v-if="activeStatus !== 'all'" class="filter-label">{{ t(stats.find(stat => stat.status === activeStatus)?.label || '') }}<button @click="activeStatus = 'all'">{{ t("Clear filter") }}</button></div><ReportTable v-if="data.reportsLoaded" :reports="recent" /><ReportTable v-else-if="data.loading" :reports="[]" :loading-label="t('Loading reports…')" /><p v-else class="live-empty">{{ t('Reports are unavailable.') }}</p></section>
    </div><div class="dashboard-secondary">
      <section class="dashboard-card activity-card"><div class="card-heading"><h2>{{ t("Recent Updates") }}</h2><RouterLink to="/reports" class="text-action">{{ t("View all") }} <ArrowRight :size="15" /></RouterLink></div><div v-if="data.reportsLoaded && updates.length" class="activity-list"><RouterLink v-for="report in updates" :key="report.id" :to="`/reports/${report.id}`" class="activity-item"><span class="activity-avatar" :class="statusTone(report.status)"><FileText :size="17" /></span><p><b>{{ t('Report #{id}', { id: report.id }) }}</b> · {{ t(statusLabels[report.status]) }}<small>{{ formatDate(report.updatedAt, true) }}</small></p></RouterLink></div><LoadingStatus v-else-if="data.loading" :label="t('Loading updates…')" /><p v-else class="live-empty">{{ t(data.reportsLoaded ? 'No report updates yet.' : 'Updates are unavailable.') }}</p></section>
      <section class="dashboard-card quick-actions"><div class="card-heading"><h2>{{ t("Quick Actions") }}</h2></div><div class="action-grid"><RouterLink v-if="data.canCreate && data.selectedSite" class="create-action" to="/reports/new"><Plus :size="25" /><span>{{ t("Create Report") }}<small>{{ t("Log a new issue") }}</small></span></RouterLink><RouterLink to="/reports"><FileText :size="23" /><span>{{ t("Browse Reports") }}<small>{{ t("Search and filter") }}</small></span></RouterLink><RouterLink to="/assignments"><Users :size="24" /><span>{{ t("Assignments") }}<small>{{ t("Current technician workload") }}</small></span></RouterLink><RouterLink to="/sites"><Leaf :size="23" /><span>{{ t("Your Sites") }}<small>{{ t("View site information") }}</small></span></RouterLink></div></section>
      <section class="dashboard-card health-card"><div class="card-heading"><h2><Activity :size="23" />{{ t("Data Connection") }}</h2><button class="icon-button" :disabled="data.loading" :aria-label="t('Check connection')" @click="data.refresh()"><RefreshCw :size="16" /></button></div><p class="connection-state">{{ t(data.loading ? 'Checking connection…' : data.sitesError || data.reportsError ? 'Data request failed' : data.lastSynced ? 'Report data connected' : 'No site data available') }}</p><p class="dialog-intro">{{ data.lastSynced ? t('Last successful refresh: {date}', { date: formatDate(data.lastSynced, true) }) : t('Connection status is based on your latest data request.') }}</p></section>
    </div></div>
    <RouterLink v-if="data.canCreate && data.selectedSite" class="floating-create" :aria-label="t('Create a report')" to="/reports/new"><Plus :size="27" /></RouterLink>
  </div>
</template>
