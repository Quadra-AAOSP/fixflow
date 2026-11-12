<script setup lang="ts">
import LoadingStatus from "@/components/ui/LoadingStatus.vue";
import { useLocale } from "@/i18n";
import { computed, ref } from "vue";
import {
  ArrowRight,
  Plus,
  FileText,
  Settings,
  CircleCheck,
  TriangleAlert,
} from "@lucide/vue";
import { useAuth } from "@/composables/useAuth";
import { useMaintenanceStore } from "@/stores/maintenance";
import {
  summarize,
  weeklyChart,
  matchesFilter,
  statusLabels,
  statusTone,
  formatDate,
  type ReportFilter,
} from "@/utils/maintenance";
import ReportTable from "@/components/dashboard/ReportTable.vue";
const { t } = useLocale();

const { user } = useAuth();
const data = useMaintenanceStore();
const period = ref(0);
const activeStatus = ref<ReportFilter>("all");
const counts = computed(() => summarize(data.reports));
const stats = computed(() => [
  {
    label: "Open Reports",
    value: counts.value.open,
    status: "open" as const,
    tone: "coral",
    icon: FileText,
    note: "Open, routed, reopened, escalated",
  },
  {
    label: "In Progress",
    value: counts.value.progress,
    status: "progress" as const,
    tone: "mint",
    icon: Settings,
    note: "Assigned and in progress",
  },
  {
    label: "Resolved",
    value: counts.value.resolved,
    status: "resolved" as const,
    tone: "citron",
    icon: CircleCheck,
    note: "Awaiting confirmation or confirmed",
  },
  {
    label: "Urgent",
    value: counts.value.urgent,
    status: "urgent" as const,
    tone: "coral",
    icon: TriangleAlert,
    note: "Active high or critical urgency",
  },
]);
const chart = computed(() => weeklyChart(data.reports, period.value));
const chartMax = computed(() =>
  Math.max(1, ...chart.value.flatMap((day) => day.values)),
);
const recent = computed(() =>
  [...data.reports]
    .filter((report) => matchesFilter(report, activeStatus.value))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 3),
);
const updates = computed(() =>
  [...data.reports]
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, 4),
);
const chartDescription = computed(() =>
  chart.value
    .map((day) =>
      t("{date}: {open} open, {progress} in progress, {resolved} resolved", {
        date: formatDate(day.date.toISOString()),
        open: day.values[0]!,
        progress: day.values[1]!,
        resolved: day.values[2]!,
      }),
    )
    .join("; "),
);
const greeting = computed(() =>
  new Date().getHours() < 12
    ? "Good morning"
    : new Date().getHours() < 18
      ? "Good afternoon"
      : "Good evening",
);
</script>

<template>
  <section class="ff-overview">
    <header class="ff-page-heading">
      <div>
        <p class="ff-context">
          {{ data.selectedSite?.name || t("Dashboard") }}
        </p>
        <h1>{{ t("Maintenance overview") }}</h1>
        <p>
          {{
            user?.firstName
              ? t("{greeting}, {name}", {
                  greeting: t(greeting),
                  name: user.firstName,
                })
              : t(greeting)
          }}
        </p>
      </div>
      <RouterLink
        v-if="data.canCreate && data.selectedSite"
        to="/reports/new"
        class="ff-primary"
        ><Plus :size="18" />{{ t("Report an Issue") }}</RouterLink
      >
    </header>
    <div v-if="data.reportsError" class="ff-alert" role="alert">
      <span>{{ t(data.reportsError) }}</span
      ><button @click="data.refresh()">{{ t("Retry") }}</button>
    </div>
    <p
      v-if="data.reportsLoaded && data.reportPage + 1 < data.totalReportPages"
      class="ff-notice"
    >
      {{
        t(
          "Report counts and results cover loaded reports. Open Reports to load more.",
        )
      }}
    </p>
    <section class="ff-metrics" :aria-label="t('Report statistics')">
      <button
        v-for="stat in stats"
        :key="stat.status"
        class="ff-metric"
        :class="[stat.tone, { active: activeStatus === stat.status }]"
        :aria-pressed="activeStatus === stat.status"
        :disabled="!data.reportsLoaded"
        :title="t(stat.note)"
        @click="
          activeStatus = activeStatus === stat.status ? 'all' : stat.status
        "
      >
        <span class="ff-metric-label"
          ><component :is="stat.icon" :size="18" />{{ t(stat.label) }}</span
        ><strong>{{ data.reportsLoaded ? stat.value : "—" }}</strong
        ><span class="ff-metric-hint"
          >{{ t(data.loading ? "Loading…" : "View reports") }}
          <ArrowRight :size="15"
        /></span>
      </button>
    </section>
    <section class="ff-surface ff-report-section">
      <header class="ff-section-heading">
        <div>
          <h2>{{ t("Recent Reports") }}</h2>
          <p v-if="activeStatus !== 'all'">
            {{
              t(stats.find((stat) => stat.status === activeStatus)?.label || "")
            }}
            <button class="ff-inline" @click="activeStatus = 'all'">
              {{ t("Clear filter") }}
            </button>
          </p>
        </div>
        <RouterLink
          :to="{
            name: 'reports',
            query: activeStatus === 'all' ? {} : { status: activeStatus },
          }"
          class="ff-inline"
          >{{ t("View all reports") }} <ArrowRight :size="16"
        /></RouterLink>
      </header>
      <ReportTable v-if="data.reportsLoaded" :reports="recent" />
      <LoadingStatus v-else-if="data.loading" :label="t('Loading reports…')" />
      <p v-else class="ff-empty">{{ t("Reports are unavailable.") }}</p>
    </section>
    <div class="ff-overview-bottom">
      <section class="ff-surface ff-trend">
        <header class="ff-section-heading">
          <div>
            <h2>{{ t("Maintenance Overview") }}</h2>
            <p>
              {{
                t(
                  period === 0
                    ? "Reports created this week, grouped by current status"
                    : "Reports created last week, grouped by current status",
                )
              }}
            </p>
          </div>
          <select v-model="period" :aria-label="t('Chart period')">
            <option :value="0">{{ t("This week") }}</option>
            <option :value="-1">{{ t("Last week") }}</option>
          </select>
        </header>
        <template v-if="data.reportsLoaded">
          <div class="ff-chart" role="img" :aria-label="chartDescription">
            <div
              v-for="day in chart"
              :key="day.date.toISOString()"
              class="ff-chart-day"
            >
              <div class="ff-chart-bars">
                <div
                  v-for="(value, index) in day.values"
                  :key="index"
                  :class="['coral', 'mint', 'citron'][index]"
                  :style="{
                    height: `${(value / chartMax) * 100}%`,
                    minHeight: value ? '3px' : '0',
                  }"
                >
                  <span v-if="value">{{ value }}</span>
                </div>
              </div>
              <span>{{ day.label }}</span>
            </div>
          </div>
          <div class="ff-chart-key">
            <span><i class="coral" />{{ t("Open") }}</span
            ><span><i class="mint" />{{ t("In Progress") }}</span
            ><span><i class="citron" />{{ t("Resolved") }}</span>
          </div>
          <p
            v-if="
              chart.every((day) => day.values.every((value) => value === 0))
            "
            class="ff-notice"
          >
            {{ t("No reports were created during this week.") }}
          </p> </template
        ><LoadingStatus
          v-else-if="data.loading"
          :label="t('Loading report data…')"
        />
        <p v-else class="ff-empty">{{ t("Report data is unavailable.") }}</p>
      </section>
      <section class="ff-surface ff-updates">
        <header class="ff-section-heading">
          <h2>{{ t("Recent Updates") }}</h2>
        </header>
        <ol v-if="data.reportsLoaded && updates.length" class="ff-timeline">
          <li v-for="report in updates" :key="report.id">
            <RouterLink :to="`/reports/${report.id}`"
              ><span
                class="ff-timeline-dot"
                :class="statusTone(report.status)" />
              <div>
                <strong>{{ t("Report #{id}", { id: report.id }) }}</strong
                ><span>{{ t(statusLabels[report.status]) }}</span
                ><time>{{ formatDate(report.updatedAt, true) }}</time>
              </div>
              <ArrowRight :size="16"
            /></RouterLink>
          </li>
        </ol>
        <LoadingStatus
          v-else-if="data.loading"
          :label="t('Loading updates…')"
        />
        <p v-else class="ff-empty">
          {{
            t(
              data.reportsLoaded
                ? "No report updates yet."
                : "Updates are unavailable.",
            )
          }}
        </p>
      </section>
    </div>
  </section>
</template>
