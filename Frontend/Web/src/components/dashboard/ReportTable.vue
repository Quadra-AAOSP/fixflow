<script setup lang="ts">
import { ArrowRight, FileText } from '@lucide/vue';
import { useMaintenanceStore } from '@/stores/maintenance';
import { formatDate, humanize, statusLabels, statusTone, effectiveUrgency, urgencyLabels } from '@/utils/maintenance';
import type { Report } from '@/types/maintenance';
defineProps<{ reports: Report[] }>();
const data = useMaintenanceStore();
</script>
<template>
  <div class="report-table-wrap"><table class="report-table live-report-table"><thead><tr><th>Report</th><th>Site</th><th>Created</th><th>Assignee</th><th>Status</th><th>Urgency</th><th><span class="sr-only">Details</span></th></tr></thead><tbody>
    <tr v-for="report in reports" :key="report.id"><td><RouterLink :to="`/reports/${report.id}`" class="report-title"><span class="report-small-icon" :class="statusTone(report.status)"><FileText :size="16" /></span><span class="report-summary"><strong>{{ report.description }}</strong><small>#{{ report.id }} · {{ humanize(report.category) }}</small></span></RouterLink></td><td>{{ data.siteName(report.siteId) }}</td><td>{{ formatDate(report.createdAt) }}</td><td>{{ report.assignedTechnicianId == null ? 'Unassigned' : `Technician #${report.assignedTechnicianId}` }}</td><td><span class="status-badge" :class="statusTone(report.status)">{{ statusLabels[report.status] }}</span></td><td>{{ urgencyLabels[effectiveUrgency(report)] }}</td><td><RouterLink :to="`/reports/${report.id}`" class="icon-button" :aria-label="`View report ${report.id}`"><ArrowRight :size="16" /></RouterLink></td></tr>
    <tr v-if="!reports.length"><td colspan="7" class="table-empty">No reports match this view.</td></tr>
  </tbody></table></div>
</template>
