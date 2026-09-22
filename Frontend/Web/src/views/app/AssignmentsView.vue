<script setup lang="ts">
import { computed } from 'vue';
import { useAuth } from '@/composables/useAuth';
import { useMaintenanceStore } from '@/stores/maintenance';
import { statusGroup } from '@/utils/maintenance';
import ReportTable from '@/components/dashboard/ReportTable.vue';
const data = useMaintenanceStore();
const { user } = useAuth();
const assignments = computed(() => data.reports.filter(report => report.assignedTechnicianId != null && (user.value?.role !== 'technician' || report.assignedTechnicianId === user.value.id) && statusGroup(report.status) !== 'resolved').sort((a,b) => (a.assignedTechnicianId ?? 0) - (b.assignedTechnicianId ?? 0)));
const technicianCount = computed(() => new Set(assignments.value.map(report => report.assignedTechnicianId)).size);
</script>
<template>
  <section class="dashboard-card live-page"><div class="card-heading"><div><h1>Current Assignments</h1><p>{{ data.selectedSite?.name }}<template v-if="data.reportsLoaded"> · {{ assignments.length }} active reports · {{ technicianCount }} assigned technicians</template></p></div></div><p class="dialog-intro">{{ data.canAssign ? 'Open a report to assign or reassign a technician.' : 'View the current assignments for your site.' }}</p><p v-if="data.loading" class="live-empty">Loading assignments…</p><p v-else-if="data.reportsError" class="live-error" role="alert">{{ data.reportsError }}</p><ReportTable v-else-if="data.reportsLoaded" :reports="assignments" /><p v-else class="live-empty">Assignments are unavailable.</p></section>
</template>
