<script setup lang="ts">
import { useLocale } from '@/i18n';
import { computed } from 'vue';
import { useAuth } from '@/composables/useAuth';
import { useMaintenanceStore } from '@/stores/maintenance';
import { statusGroup } from '@/utils/maintenance';
import ReportTable from '@/components/dashboard/ReportTable.vue';
const { t } = useLocale();
const data = useMaintenanceStore();
const { user } = useAuth();
const assignments = computed(() => data.reports.filter(report => report.assignedTechnicianId != null && (user.value?.role !== 'technician' || report.assignedTechnicianId === user.value.id) && statusGroup(report.status) !== 'resolved').sort((a,b) => (a.assignedTechnicianId ?? 0) - (b.assignedTechnicianId ?? 0)));
const technicianCount = computed(() => new Set(assignments.value.map(report => report.assignedTechnicianId)).size);
</script>
<template>
  <p v-if="data.reportsLoaded && data.reportPage + 1 < data.totalReportPages" class="dialog-intro">{{ t("Report counts and results cover loaded reports. Open Reports to load more.") }} <RouterLink to="/reports">{{ t("Reports") }}</RouterLink></p>
  <section class="dashboard-card live-page"><div class="card-heading"><div><h1>{{ t("Current Assignments") }}</h1><p>{{ data.selectedSite?.name }}<template v-if="data.reportsLoaded"> · {{ t('{reports} active reports · {technicians} assigned technicians', { reports: assignments.length, technicians: technicianCount }) }}</template></p></div></div><p class="dialog-intro">{{ t(data.canAssign ? 'Open a report to assign or reassign a technician.' : 'View the current assignments for your site.') }}</p><ReportTable v-if="data.loading" :reports="[]" :loading-label="t('Loading assignments…')" /><p v-else-if="data.reportsError" class="live-error" role="alert">{{ t(data.reportsError) }}</p><ReportTable v-else-if="data.reportsLoaded" :reports="assignments" /><p v-else class="live-empty">{{ t("Assignments are unavailable.") }}</p></section>
</template>
