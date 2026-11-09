<script setup lang="ts">
import { useLocale } from '@/i18n';
import { ArrowRight, FileText } from '@lucide/vue';
import { useMaintenanceStore } from '@/stores/maintenance';
import { formatDate, humanize, statusLabels, statusTone, effectiveUrgency, urgencyLabels } from '@/utils/maintenance';
import type { Report } from '@/types/maintenance';
const { t } = useLocale();
defineProps<{ reports: Report[]; loadingLabel?: string }>();
const data = useMaintenanceStore();
</script>
<template>
  <div class="report-table-wrap" role="region" :aria-label="t('Reports table')" :tabindex="loadingLabel ? undefined : 0"><table class="report-table live-report-table"><caption class="sr-only">{{ t('Reports for the selected site') }}</caption><colgroup><col class="report-column-title" /><col span="3" class="report-column-meta" /><col class="report-column-status" /><col class="report-column-urgency" /><col /></colgroup><thead><tr><th scope="col">{{ t("Report") }}</th><th scope="col">{{ t("Site") }}</th><th scope="col">{{ t("Created") }}</th><th scope="col">{{ t("Assignee") }}</th><th scope="col">{{ t("Status") }}</th><th scope="col">{{ t("Urgency") }}</th><th scope="col"><span class="sr-only">{{ t("Details") }}</span></th></tr></thead><tbody v-if="loadingLabel"><tr><td colspan="7" class="table-empty"><span role="status">{{ loadingLabel }}</span></td></tr></tbody><tbody v-else>
    <tr v-for="report in reports" :key="report.id"><td><RouterLink :to="`/reports/${report.id}`" class="report-title"><span class="report-small-icon" :class="statusTone(report.status)"><FileText :size="16" /></span><span class="report-summary"><strong>{{ report.description }}</strong><small>#{{ report.id }} · {{ t(humanize(report.category)) }}</small></span></RouterLink></td><td>{{ data.siteName(report.siteId) }}</td><td>{{ formatDate(report.createdAt) }}</td><td>{{ report.assignedTechnicianId == null ? t('Unassigned') : t('Technician #{id}', { id: report.assignedTechnicianId }) }}</td><td><span class="status-badge" :class="statusTone(report.status)">{{ t(statusLabels[report.status]) }}</span></td><td>{{ t(urgencyLabels[effectiveUrgency(report)]) }}</td><td><RouterLink :to="`/reports/${report.id}`" class="icon-button" :aria-label="t('View report {id}', { id: report.id })"><ArrowRight :size="16" /></RouterLink></td></tr>
    <tr v-if="!reports.length"><td colspan="7" class="table-empty">{{ t("No reports match this view.") }}</td></tr>
  </tbody></table></div>
</template>

<style scoped>
.live-report-table { min-width: 42rem; table-layout: fixed; }
.report-column-title { width: 29%; }
.report-column-meta { width: 14%; }
.report-column-status { width: 12%; }
.report-column-urgency { width: 10%; }
.report-summary { min-width: 0; }
</style>
