<script setup lang="ts">
import { useLocale } from "@/i18n";
import { computed } from "vue";
import { useAuth } from "@/composables/useAuth";
import { useMaintenanceStore } from "@/stores/maintenance";
import { statusGroup } from "@/utils/maintenance";
import ReportTable from "@/components/dashboard/ReportTable.vue";
const { t } = useLocale();
const data = useMaintenanceStore();
const { user } = useAuth();
const assignments = computed(() =>
  data.reports
    .filter(
      (report) =>
        report.assignedTechnicianId != null &&
        (user.value?.role !== "technician" ||
          report.assignedTechnicianId === user.value.id) &&
        statusGroup(report.status) !== "resolved",
    )
    .sort(
      (a, b) => (a.assignedTechnicianId ?? 0) - (b.assignedTechnicianId ?? 0),
    ),
);
const technicianCount = computed(
  () =>
    new Set(assignments.value.map((report) => report.assignedTechnicianId))
      .size,
);
</script>
<template>
  <div class="assignments-page">
    <header class="assignments-header">
      <div>
        <p class="assignments-site">{{ data.selectedSite?.name }}</p>
        <h1>{{ t("Current Assignments") }}</h1>
        <p>
          {{
            t(
              data.canAssign
                ? "Open a report to assign or reassign a technician."
                : "View the current assignments for your site.",
            )
          }}
        </p>
      </div>
      <RouterLink to="/reports" class="text-action"
        >{{ t("View all reports") }} →</RouterLink
      >
    </header>
    <div
      v-if="data.reportsLoaded"
      class="assignments-summary"
      :aria-label="t('Current Assignments')"
    >
      <div>
        <strong>{{ assignments.length }}</strong
        ><span>{{ t("Active reports") }}</span>
      </div>
      <div>
        <strong>{{ technicianCount }}</strong
        ><span>{{ t("Assigned technicians") }}</span>
      </div>
    </div>
    <section class="dashboard-card assignments-list">
      <div class="assignments-list-heading">
        <h2>{{ t("Active assignments") }}</h2>
        <p
          v-if="
            data.reportsLoaded && data.reportPage + 1 < data.totalReportPages
          "
        >
          {{
            t(
              "Report counts and results cover loaded reports. Open Reports to load more.",
            )
          }}
        </p>
      </div>
      <ReportTable
        v-if="data.loading"
        :reports="[]"
        :loading-label="t('Loading assignments…')"
      />
      <p v-if="data.reportsError" class="live-error" role="alert">
        {{ t(data.reportsError) }}
        <button @click="data.refresh()">{{ t("Retry") }}</button>
      </p>
      <ReportTable
        v-if="data.reportsLoaded && !data.loading"
        :reports="assignments"
      />
      <p v-else-if="!data.loading && !data.reportsError" class="live-empty">
        {{ t("Assignments are unavailable.") }}
      </p>
    </section>
  </div>
</template>
<style scoped>
.assignments-page {
  display: grid;
  gap: 22px;
}
.assignments-header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 20px;
  border-bottom: 1px solid #e0e9e4;
  padding: 10px 0 24px;
}
.assignments-header h1 {
  font-size: 32px;
  letter-spacing: -0.03em;
  font-weight: 700;
}
.assignments-header p {
  color: #52677b;
  margin-top: 6px;
}
.assignments-site {
  color: #006f65 !important;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.assignments-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}
.assignments-summary > div {
  background: #fff;
  border: 1px solid #e0e9e4;
  border-radius: 12px;
  padding: 18px 22px;
  display: grid;
  gap: 4px;
}
.assignments-summary strong {
  font-size: 28px;
  line-height: 1;
}
.assignments-summary span,
.assignments-list-heading p {
  color: #52677b;
  font-size: 13px;
}
.assignments-list {
  padding: 24px;
}
.assignments-list-heading {
  margin-bottom: 18px;
}
.assignments-list-heading h2 {
  font-size: 18px;
  font-weight: 700;
}
@media (max-width: 650px) {
  .assignments-header {
    align-items: start;
    flex-direction: column;
  }
  .assignments-list {
    padding: 16px;
  }
}
</style>
