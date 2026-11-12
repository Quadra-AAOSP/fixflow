<script setup lang="ts">
import { computed } from "vue";
import { Plus, FileText } from "@lucide/vue";
import { useAuth } from "@/composables/useAuth";
import { useMaintenanceStore } from "@/stores/maintenance";
import { useLocale } from "@/i18n";
import ReportTable from "@/components/dashboard/ReportTable.vue";
const { user } = useAuth();
const data = useMaintenanceStore();
const { t } = useLocale();
// Membership comes from server policy; masked peer data never implies participation.
const mine = computed(() =>
  data.reports
    .filter(
      (report) =>
        report.policy?.participant === true ||
        report.createdByUserId === user.value?.id,
    )
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
);
</script>
<template>
  <div class="reporter-page">
    <header class="reporter-header">
      <div>
        <p class="reporter-context">{{ data.selectedSite?.name }}</p>
        <h1>{{ t("My reports") }}</h1>
        <p>{{ t("Follow issues you reported or joined.") }}</p>
      </div>
      <RouterLink
        v-if="data.canCreate && data.selectedSite"
        to="/reports/new"
        class="report-issue-button"
        ><Plus :size="19" />{{ t("New report") }}</RouterLink
      >
    </header>
    <section
      class="reporter-list dashboard-card"
      aria-labelledby="my-reports-heading"
    >
      <div class="reporter-list-heading">
        <div>
          <h2 id="my-reports-heading">{{ t("Reports you follow") }}</h2>
          <p v-if="data.reportsLoaded">
            {{ t("{count} matching reports", { count: mine.length }) }}
          </p>
        </div>
        <RouterLink class="text-action" to="/reports"
          ><FileText :size="16" />{{ t("Browse all site reports") }}</RouterLink
        >
      </div>
      <p
        v-if="data.reportsLoaded && data.reportPage + 1 < data.totalReportPages"
        class="dialog-intro"
      >
        {{
          t(
            "Report counts and results cover loaded reports. Open Reports to load more.",
          )
        }}
      </p>
      <ReportTable
        v-if="data.loading"
        :reports="[]"
        :loading-label="t('Loading reports…')"
      />
      <p v-if="data.reportsError" role="alert" class="live-error">
        {{ t(data.reportsError) }}
        <button type="button" @click="data.refresh()">{{ t("Retry") }}</button>
      </p>
      <template v-if="data.reportsLoaded && !data.loading"
        ><ReportTable v-if="mine.length" :reports="mine" />
        <p v-else-if="!data.loading && !data.reportsError" class="live-empty">
          {{
            t("You have not reported or joined any issues at this site yet.")
          }}
        </p></template
      >
      <p v-else-if="!data.loading && !data.reportsError" class="live-empty">
        {{ t("Select an accessible site to view its reports.") }}
      </p>
    </section>
  </div>
</template>
<style scoped>
.reporter-page {
  display: grid;
  gap: 24px;
}
.reporter-header,
.reporter-list-heading {
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: 20px;
}
.reporter-header {
  padding: 10px 0 24px;
  border-bottom: 1px solid #e0e9e4;
}
.reporter-header h1 {
  font-size: 32px;
  font-weight: 700;
  letter-spacing: -0.03em;
}
.reporter-header p,
.reporter-list-heading p {
  color: #52677b;
  margin-top: 6px;
}
.reporter-context {
  font-size: 12px;
  font-weight: 700;
  color: #006f65 !important;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.reporter-list {
  padding: 24px;
}
.reporter-list-heading {
  margin-bottom: 20px;
}
.reporter-list-heading h2 {
  font-size: 18px;
  font-weight: 700;
}
@media (max-width: 650px) {
  .reporter-header,
  .reporter-list-heading {
    align-items: start;
    flex-direction: column;
  }
  .reporter-list {
    padding: 16px;
  }
}
</style>
