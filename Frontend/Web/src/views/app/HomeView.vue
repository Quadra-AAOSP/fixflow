<script setup lang="ts">
import { computed, ref } from 'vue';
import { ArrowRight, Plus, FileText, Settings, CircleCheck, TriangleAlert, Leaf, Heart, Users, Activity, RefreshCw } from '@lucide/vue';
import { useAuth } from '@/composables/useAuth';
import { useMaintenanceStore } from '@/stores/maintenance';
import { summarize, weeklyChart, matchesFilter, statusLabels, statusTone, formatDate, type ReportFilter } from '@/utils/maintenance';
import PlantArt from '@/components/dashboard/PlantArt.vue';
import ReportTable from '@/components/dashboard/ReportTable.vue';

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
const chartDescription = computed(() => chart.value.map(day => `${formatDate(day.date.toISOString())}: ${day.values[0]} open, ${day.values[1]} in progress, ${day.values[2]} resolved`).join('; '));
const greeting = computed(() => new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening');
</script>

<template>
  <div class="home-dashboard">
    <section class="welcome-banner"><div class="welcome-copy"><h1>{{ greeting }}<template v-if="user?.firstName">, {{ user.firstName }}</template></h1><p>Let’s keep every space working beautifully.</p><div class="welcome-values"><span><Leaf :size="18" />Safe spaces</span><span><Heart :size="18" fill="currentColor" />Happy people</span><span><Users :size="19" />Stronger communities</span></div></div><div class="welcome-art"><PlantArt /><span>Small fixes<br />make a big<br />difference.<i /></span></div><RouterLink v-if="data.canCreate && data.selectedSite" class="report-issue-button" to="/reports/new"><span><Plus :size="21" /></span>Report an Issue</RouterLink></section>
    <div class="preview-label"><span>{{ data.selectedSite?.name || 'Your maintenance overview' }}</span><span>YOUR COMMUNITY AT A GLANCE</span></div>
    <div v-if="data.reportsError" class="live-error" role="alert">Reports could not be loaded: {{ data.reportsError }} <button @click="data.refresh()">Retry</button></div>
    <section class="stat-grid" aria-label="Report statistics"><button v-for="stat in stats" :key="stat.label" class="stat-card" :class="{ 'stat-selected': activeStatus === stat.status }" :aria-pressed="activeStatus === stat.status" :disabled="!data.reportsLoaded" :title="stat.note" @click="activeStatus = activeStatus === stat.status ? 'all' : stat.status"><span class="stat-icon" :class="stat.tone"><component :is="stat.icon" :size="29" :stroke-width="1.7" /></span><span class="stat-content"><span>{{ stat.label }}</span><strong>{{ data.reportsLoaded ? stat.value : '—' }}</strong><small>{{ data.loading ? 'Loading…' : 'Current site reports' }}</small></span></button></section>
    <div class="dashboard-columns"><div class="dashboard-primary">
      <section class="dashboard-card overview-card"><div class="card-heading"><div><h2>Maintenance Overview</h2><p>Reports created {{ period === 0 ? 'this week' : 'last week' }}, grouped by current status</p></div><select v-model="period" aria-label="Chart period"><option :value="0">This week</option><option :value="-1">Last week</option></select></div>
        <template v-if="data.reportsLoaded"><div class="bar-chart" role="img" :aria-label="chartDescription"><div class="chart-y-axis"><span>{{ chartMax }}</span><span>0</span></div><div class="chart-plot"><div class="chart-grid-lines"><i /><i /></div><div v-for="day in chart" :key="day.date.toISOString()" class="chart-day"><div class="chart-bars"><div v-for="(value, index) in day.values" :key="index" class="chart-bar" :class="['coral','mint','citron'][index]" :style="{ height: `${value / chartMax * 100}%`, minHeight: value ? '2px' : '0' }"><span>{{ value }}</span></div></div><span class="day-label">{{ day.label }}</span></div></div></div><div class="chart-legend"><span><i class="coral" />Open</span><span><i class="mint" />In Progress</span><span><i class="citron" />Resolved</span></div><p v-if="chart.every(day => day.values.every(value => value === 0))" class="chart-empty">No reports were created during this week.</p></template><p v-else class="live-empty">{{ data.loading ? 'Loading report data…' : 'Report data is unavailable.' }}</p>
      </section>
      <section class="dashboard-card reports-card"><div class="card-heading"><h2>Recent Reports</h2><RouterLink :to="{ name: 'reports', query: activeStatus === 'all' ? {} : { status: activeStatus } }" class="text-action">View all <ArrowRight :size="15" /></RouterLink></div><div v-if="activeStatus !== 'all'" class="filter-label">{{ stats.find(stat => stat.status === activeStatus)?.label }}<button @click="activeStatus = 'all'">Clear filter</button></div><ReportTable v-if="data.reportsLoaded" :reports="recent" /><p v-else class="live-empty">{{ data.loading ? 'Loading reports…' : 'Reports are unavailable.' }}</p></section>
    </div><div class="dashboard-secondary">
      <section class="dashboard-card activity-card"><div class="card-heading"><h2>Recent Updates</h2><RouterLink to="/reports" class="text-action">View all <ArrowRight :size="15" /></RouterLink></div><div v-if="data.reportsLoaded && updates.length" class="activity-list"><RouterLink v-for="report in updates" :key="report.id" :to="`/reports/${report.id}`" class="activity-item"><span class="activity-avatar" :class="statusTone(report.status)"><FileText :size="17" /></span><p><b>Report #{{ report.id }}</b> · {{ statusLabels[report.status] }}<small>{{ formatDate(report.updatedAt, true) }}</small></p></RouterLink></div><p v-else class="live-empty">{{ data.loading ? 'Loading updates…' : data.reportsLoaded ? 'No report updates yet.' : 'Updates are unavailable.' }}</p></section>
      <section class="dashboard-card quick-actions"><div class="card-heading"><h2>Quick Actions</h2></div><div class="action-grid"><RouterLink v-if="data.canCreate && data.selectedSite" class="create-action" to="/reports/new"><Plus :size="25" /><span>Create Report<small>Log a new issue</small></span></RouterLink><RouterLink to="/reports"><FileText :size="23" /><span>Browse Reports<small>Search and filter</small></span></RouterLink><RouterLink to="/assignments"><Users :size="24" /><span>Assignments<small>Current technician workload</small></span></RouterLink><RouterLink to="/sites"><Leaf :size="23" /><span>Your Sites<small>View site information</small></span></RouterLink></div></section>
      <section class="dashboard-card health-card"><div class="card-heading"><h2><Activity :size="23" />Data Connection</h2><button class="icon-button" :disabled="data.loading" aria-label="Check connection" @click="data.refresh()"><RefreshCw :size="16" /></button></div><p class="connection-state">{{ data.loading ? 'Checking connection…' : data.sitesError || data.reportsError ? 'Data request failed' : data.lastSynced ? 'Report data connected' : 'No site data available' }}</p><p class="dialog-intro">{{ data.lastSynced ? `Last successful refresh: ${formatDate(data.lastSynced, true)}` : 'Connection status is based on your latest data request.' }}</p></section>
    </div></div>
    <RouterLink v-if="data.canCreate && data.selectedSite" class="floating-create" aria-label="Create a report" to="/reports/new"><Plus :size="27" /></RouterLink>
  </div>
</template>
