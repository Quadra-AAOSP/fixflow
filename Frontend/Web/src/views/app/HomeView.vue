<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowRight, Plus, FileText, Settings, CircleCheck, TriangleAlert, Leaf, Heart, Users, Activity, SquareCheck, X, MapPin, Clock, MessageCircle } from '@lucide/vue';
import { useAuth } from '@/composables/useAuth';
import PlantArt from '@/components/dashboard/PlantArt.vue';
import AvatarPortrait from '@/components/dashboard/AvatarPortrait.vue';

const { user } = useAuth();
const route = useRoute();
const router = useRouter();
const period = ref('This week');
const activeStatus = ref('All');
const dialog = ref<HTMLDialogElement>();
const mode = ref('');
const title = ref('');
const location = ref('');
const description = ref('');
const saved = ref('');
const draftError = ref('');
const selected = ref<Report>();
type Report = { id: number; title: string; site: string; date: string; assignee: string; initials: string; status: string; tone: string; description: string };
const reports = ref<Report[]>([
  { id: 1042, title: 'Water leak in restroom', site: 'Main Building', date: 'Sep 21, 2026', assignee: 'Alex Rivera', initials: 'AR', status: 'Urgent', tone: 'coral', description: 'Water is pooling underneath the basin in the ground-floor restroom. Please inspect the pipe connection.' },
  { id: 1041, title: 'Broken light fixture', site: 'West Wing', date: 'Sep 20, 2026', assignee: 'Priya Shah', initials: 'PS', status: 'In Progress', tone: 'mint', description: 'The hallway light outside room 204 is flickering. A technician is working on the repair.' },
  { id: 1040, title: 'Air conditioner noise', site: 'North Facility', date: 'Sep 19, 2026', assignee: 'Marcus Lee', initials: 'ML', status: 'Open', tone: 'coral', description: 'The air conditioner in the shared lounge makes a rattling sound when running.' },
  { id: 1039, title: 'Entrance door repaired', site: 'Main Building', date: 'Sep 18, 2026', assignee: 'Elena Park', initials: 'EP', status: 'Resolved', tone: 'citron', description: 'The entrance door hinge was replaced and the repair was confirmed.' },
]);
const filteredReports = computed(() => reports.value.filter(report => (activeStatus.value === 'All' || report.status === activeStatus.value) && `${report.title} ${report.site} ${report.assignee}`.toLowerCase().includes(String(route.query.q || '').toLowerCase())));
const stats = [
  { label: 'Open Reports', value: 24, change: '+ 6', status: 'Open', tone: 'coral', icon: FileText },
  { label: 'In Progress', value: 9, change: '+ 2', status: 'In Progress', tone: 'mint', icon: Settings },
  { label: 'Resolved', value: 48, change: '+ 12', status: 'Resolved', tone: 'citron', icon: CircleCheck },
  { label: 'Urgent', value: 3, change: '+ 1', status: 'Urgent', tone: 'coral', icon: TriangleAlert },
];
const chart = computed(() => period.value === 'This week' ? [[5,10,7],[6,3,3],[10,3,7],[3,7,2],[6,3,4],[3,6,3],[3,8,6]] : [[4,7,5],[3,5,6],[7,4,9],[5,6,4],[4,8,6],[2,5,7],[4,6,8]]);
const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const team = [
  { name: 'Alex Rivera', initials: 'AR', action: 'marked a report as resolved', time: '2 hours ago', icon: CircleCheck, tone: 'citron' },
  { name: 'Priya Shah', initials: 'PS', action: 'updated a report', time: '3 hours ago', icon: Settings, tone: 'mint' },
  { name: 'Marcus Lee', initials: 'ML', action: 'added a comment', time: '5 hours ago', icon: MessageCircle, tone: 'mint' },
  { name: 'Elena Park', initials: 'EP', action: 'assigned a technician', time: '7 hours ago', icon: Users, tone: 'coral' },
];
function open(modeName: string, report?: Report) { mode.value = modeName; selected.value = report; dialog.value?.showModal(); }
function saveDraft() {
  if (![title.value, location.value, description.value].every(value => value.trim())) {
    draftError.value = 'Please add a title, location, and description.';
    return;
  }
  draftError.value = '';
  reports.value.unshift({ id: Date.now(), title: title.value.trim(), site: location.value.trim(), date: 'Just now', assignee: 'Not assigned', initials: '—', status: 'Draft', tone: 'mint', description: description.value.trim() });
  saved.value = 'Draft added to this preview. It has not been submitted and will clear when you reload.';
  title.value = ''; location.value = ''; description.value = ''; activeStatus.value = 'All'; router.replace({ query: {} }); dialog.value?.close();
}
async function browseReports() { activeStatus.value = 'All'; await router.replace({ query: {} }); document.getElementById('recent-reports')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
</script>

<template>
  <div class="home-dashboard">
    <section class="welcome-banner">
      <div class="welcome-copy"><h1>Good {{ new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening' }}, {{ user?.firstName || 'Sandrine' }}</h1><p>Let’s keep every space working beautifully.</p><div class="welcome-values"><span><Leaf :size="18" />Safe spaces</span><span><Heart :size="18" fill="currentColor" />Happy people</span><span><Users :size="19" />Stronger communities</span></div></div>
      <div class="welcome-art"><PlantArt /><span>Small fixes<br />make a big<br />difference.<i /></span></div>
      <button class="report-issue-button" @click="open('create')"><span><Plus :size="21" /></span>Report an Issue</button>
    </section>
    <div class="preview-label"><span><i />Design preview · Sample data</span><span>YOUR COMMUNITY AT A GLANCE</span></div>
    <section class="stat-grid" aria-label="Report statistics">
      <button v-for="stat in stats" :key="stat.label" class="stat-card" :class="{ 'stat-selected': activeStatus === stat.status }" :aria-pressed="activeStatus === stat.status" @click="activeStatus = activeStatus === stat.status ? 'All' : stat.status">
        <span class="stat-icon" :class="stat.tone"><component :is="stat.icon" :size="29" :stroke-width="1.7" /></span><span class="stat-content"><span>{{ stat.label }}</span><strong>{{ stat.value }}</strong><small><b>{{ stat.change }}</b> from last week</small></span>
      </button>
    </section>
    <div class="dashboard-columns">
      <div class="dashboard-primary">
        <section class="dashboard-card overview-card"><div class="card-heading"><div><h2>Maintenance Overview</h2><p>Number of reports by status {{ period.toLowerCase() }}</p></div><select v-model="period" aria-label="Chart period"><option>This week</option><option>Last week</option></select></div>
          <div class="bar-chart" role="img" :aria-label="`${period} sample reports. ${days.map((day, index) => `${day}: ${chart[index]?.join(', ')} open, in progress, resolved`).join('; ')}`">
            <div class="chart-y-axis"><span>15</span><span>10</span><span>5</span><span>0</span></div><div class="chart-plot"><div class="chart-grid-lines"><i /><i /><i /><i /></div><div v-for="(values, index) in chart" :key="days[index]" class="chart-day"><div class="chart-bars"><div v-for="(value, statusIndex) in values" :key="statusIndex" class="chart-bar" :class="['coral','mint','citron'][statusIndex]" :style="{ height: `${value / 15 * 100}%` }"><span>{{ value }}</span></div></div><span class="day-label">{{ days[index] }}</span></div></div>
          </div><div class="chart-legend"><span><i class="coral" />Open</span><span><i class="mint" />In Progress</span><span><i class="citron" />Resolved</span></div>
        </section>
        <section id="recent-reports" class="dashboard-card reports-card"><div class="card-heading"><h2>{{ activeStatus === 'All' ? 'Recent Reports' : `${activeStatus} Reports` }}</h2><button class="text-action" @click="open('reports')">View all <ArrowRight :size="15" /></button></div>
          <div v-if="saved" class="draft-notice" role="status">{{ saved }}<button aria-label="Dismiss message" @click="saved = ''"><X :size="15" /></button></div>
          <div v-if="activeStatus !== 'All' || route.query.q" class="filter-label">{{ route.query.q ? `Search: ${route.query.q}` : `Filtered by ${activeStatus}` }}<button v-if="activeStatus !== 'All'" @click="activeStatus = 'All'">Clear filter</button></div>
          <div class="report-table-wrap"><table class="report-table"><thead><tr><th>Title</th><th>Site</th><th>Date</th><th>Assignee</th><th>Status</th><th><span class="sr-only">Details</span></th></tr></thead><tbody><tr v-for="report in filteredReports.slice(0, 3)" :key="report.id"><td><button class="report-title" @click="open('detail', report)"><span class="report-small-icon" :class="report.tone"><TriangleAlert v-if="report.status === 'Urgent'" :size="17" /><Settings v-else-if="report.status === 'In Progress'" :size="17" /><FileText v-else :size="16" /></span>{{ report.title }}</button></td><td>{{ report.site }}</td><td>{{ report.date }}</td><td><span class="assignee"><span class="mini-avatar" :class="report.tone"><AvatarPortrait :initials="report.initials" /></span>{{ report.assignee }}</span></td><td><span class="status-badge" :class="report.tone">{{ report.status }}</span></td><td><button class="icon-button" :aria-label="`View ${report.title}`" @click="open('detail', report)"><ArrowRight :size="15" /></button></td></tr><tr v-if="!filteredReports.length"><td colspan="6" class="table-empty">No reports match. Try another search or status.</td></tr></tbody></table></div>
        </section>
      </div>
      <div class="dashboard-secondary">
        <section class="dashboard-card activity-card"><div class="card-heading"><h2>Team Activity</h2><button class="text-action" @click="open('activity')">View all <ArrowRight :size="15" /></button></div><div class="activity-list"><div v-for="person in team" :key="person.name" class="activity-item"><span class="activity-avatar" :class="person.tone"><AvatarPortrait :initials="person.initials" /><i :class="person.tone"><component :is="person.icon" :size="11" /></i></span><p><b>{{ person.name }}</b> {{ person.action }}<small>{{ person.time }}</small></p></div></div></section>
        <section class="dashboard-card quick-actions"><div class="card-heading"><h2>Quick Actions</h2></div><div class="action-grid"><button class="create-action" @click="open('create')"><Plus :size="25" /><span>Create Report<small>Log a new issue</small></span></button><button @click="browseReports"><FileText :size="23" /><span>Browse Reports<small>View and filter</small></span></button><button @click="open('queue')"><Users :size="24" /><span>Technician Queue<small>See assignments</small></span></button><button @click="open('checks')"><SquareCheck :size="23" /><span>System Checks<small>View connection status</small></span></button></div></section>
        <section class="dashboard-card health-card"><div class="card-heading"><h2><Activity :size="23" />System Health</h2><span class="health-label">Preview mode <i /></span></div><div class="health-grid"><div><b><i />API</b><strong>Not connected</strong><small>Live data coming next</small></div><div><b><i />Uploads</b><strong>Not connected</strong><small>Preview only</small></div><div><b><i />Tests</b><strong>Not run</strong><small>No live results</small></div></div></section>
      </div>
    </div>
    <button class="floating-create" aria-label="Create a report" @click="open('create')"><Plus :size="27" /></button>
    <dialog ref="dialog" class="dashboard-dialog" aria-label="Dashboard preview details" @click="(event) => { if (event.target === dialog) dialog?.close(); }"><div class="dialog-heading"><div><span class="section-eyebrow">DESIGN PREVIEW</span><h2>{{ mode === 'create' ? 'Report an issue' : mode === 'reports' ? 'All reports' : mode === 'detail' ? selected?.title : mode === 'activity' ? 'Team activity' : mode === 'queue' ? 'Technician queue' : 'System checks' }}</h2></div><button class="icon-button" aria-label="Close dialog" @click="dialog?.close()"><X :size="22" /></button></div>
      <template v-if="mode === 'create'"><p class="dialog-intro">Try the report form. Drafts stay in this preview until you reload; they are not sent to your maintenance team.</p><form class="draft-form" @submit.prevent="saveDraft"><p v-if="draftError" role="alert" class="draft-error">{{ draftError }}</p><label>Issue title<input v-model="title" required maxlength="120" placeholder="e.g. Leaky tap in the shared kitchen" /></label><label>Location<input v-model="location" required maxlength="100" placeholder="Building, floor, and room" /></label><label>What happened?<textarea v-model="description" required maxlength="2000" rows="4" placeholder="A few details help the team understand the issue." /></label><button class="report-issue-button" type="submit">Save preview draft <ArrowRight :size="18" /></button></form></template>
      <template v-else-if="mode === 'detail' && selected"><span class="status-badge" :class="selected.tone">{{ selected.status }}</span><p class="report-description">{{ selected.description }}</p><div class="detail-list-item"><MapPin :size="18" />{{ selected.site }}</div><div class="detail-list-item"><Users :size="18" />{{ selected.assignee }}</div><div class="detail-list-item"><Clock :size="18" />{{ selected.date }}</div><p class="dialog-intro">This is a sample report, not a live maintenance request.</p></template>
      <template v-else-if="mode === 'reports'"><p class="dialog-intro">All sample reports and drafts in this preview.</p><button v-for="report in reports" :key="report.id" class="detail-list-item detail-report-button" @click="mode = 'detail'; selected = report"><span><strong>{{ report.title }}</strong><small>{{ report.site }}</small></span><span class="status-badge" :class="report.tone">{{ report.status }}</span></button></template>
      <template v-else-if="mode === 'activity' || mode === 'queue'"><p class="dialog-intro">Sample {{ mode === 'queue' ? 'assignments' : 'activity' }} for the design preview.</p><div v-for="person in team" :key="person.name" class="detail-list-item"><span class="mini-avatar" :class="person.tone"><AvatarPortrait :initials="person.initials" /></span><div><strong>{{ person.name }}</strong><p>{{ mode === 'queue' ? reports.find(report => report.assignee === person.name)?.title || 'No current assignments' : person.action }}</p></div></div></template>
      <p v-else class="dialog-intro">This dashboard is a design preview. API health, photo uploads, and test results are not connected. No live checks have been run.</p>
    </dialog>
  </div>
</template>
