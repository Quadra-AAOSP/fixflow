<script setup lang="ts">
import { computed } from 'vue';
import { Plus, FileText } from '@lucide/vue';
import { useAuth } from '@/composables/useAuth';
import { useMaintenanceStore } from '@/stores/maintenance';
import { useLocale } from '@/i18n';
import ReportTable from '@/components/dashboard/ReportTable.vue';
const { user } = useAuth();
const data = useMaintenanceStore();
const { t } = useLocale();
// Membership comes from server policy; masked peer data never implies participation.
const mine = computed(() => data.reports.filter(report =>
  report.policy?.participant === true || report.createdByUserId === user.value?.id,
).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)));
</script>
<template>
  <section class="dashboard-card live-page">
    <div class="card-heading"><div><h1>{{ t('My reports') }}</h1><p>{{ t('Follow issues you reported or joined.') }}</p></div>
      <RouterLink v-if="data.canCreate && data.selectedSite" to="/reports/new" class="report-issue-button"><Plus :size="19" />{{ t('New report') }}</RouterLink>
    </div>
    <p class="dialog-intro">{{ t('Browse your community’s reports to find an existing issue before creating another.') }} <RouterLink class="text-action" to="/reports"><FileText :size="16" />{{ t('Browse Reports') }}</RouterLink></p>
    <p v-if="data.loading" role="status" class="live-empty">{{ t('Loading reports…') }}</p>
    <p v-else-if="data.reportsError" role="alert" class="live-error">{{ t(data.reportsError) }} <button type="button" @click="data.refresh()">{{ t('Retry') }}</button></p>
    <template v-else-if="data.reportsLoaded"><ReportTable v-if="mine.length" :reports="mine" /><p v-else class="live-empty">{{ t('You have not reported or joined any issues at this site yet.') }}</p></template>
    <p v-else class="live-empty">{{ t('Select an accessible site to view its reports.') }}</p>
  </section>
</template>
