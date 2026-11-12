<script setup lang="ts">
import { useAuthStore } from "@/stores/auth";
import { useLocale } from "@/i18n";
import { computed, ref, watch } from "vue";
import { request, errorMessage } from "@/services/api";
import { useRoute, useRouter } from "vue-router";
import { Plus } from "@lucide/vue";
import { useMaintenanceStore } from "@/stores/maintenance";
import { searchReports, type ReportFilter } from "@/utils/maintenance";
import ReportTable from "@/components/dashboard/ReportTable.vue";
const { t } = useLocale();
const data = useMaintenanceStore();
const auth = useAuthStore();
const visibility = ref("all");
const route = useRoute();
const router = useRouter();
const filter = computed<ReportFilter>(() =>
  ["open", "progress", "resolved", "urgent"].includes(
    String(route.query.status),
  )
    ? (route.query.status as ReportFilter)
    : "all",
);
type Filters = {
  status?: string | null;
  category?: string | null;
  urgency?: string | null;
  from?: string | null;
  to?: string | null;
  text?: string | null;
};
const aiQuery = ref("");
const aiFilters = ref<Filters | null>(null);
const aiBusy = ref(false);
const aiError = ref("");
const aiNotice = ref("");
const aiReports = ref<typeof data.reports>([]);
const aiPage = ref(0);
const aiHasMore = ref(false);
let generation = 0;
async function loadAi(page = 0) {
  const siteId = data.selectedSite?.id;
  if (!siteId || !aiFilters.value) return;
  const current = ++generation;
  aiBusy.value = true;
  aiError.value = "";
  try {
    const result = await request<{
      content: typeof data.reports;
      page: number;
      hasMore: boolean;
    }>("/api/reports/search", {
      method: "POST",
      body: JSON.stringify({
        siteId,
        filters: {
          ...aiFilters.value,
          ...(visibility.value !== "all"
            ? { visibility: visibility.value }
            : {}),
        },
        page,
        size: 20,
      }),
    });
    if (current !== generation) return;
    aiReports.value = page
      ? [...aiReports.value, ...result.content]
      : result.content;
    aiPage.value = result.page;
    aiHasMore.value = result.hasMore;
  } catch (error) {
    if (current === generation) aiError.value = errorMessage(error);
  } finally {
    if (current === generation) aiBusy.value = false;
  }
}
watch([aiFilters, visibility], () => {
  if (aiFilters.value) {
    aiReports.value = [];
    void loadAi();
  } else {
    generation++;
    aiReports.value = [];
    aiBusy.value = false;
  }
});
watch([() => data.selectedSite?.id, () => auth.user?.id], () => {
  generation++;
  aiFilters.value = null;
  aiQuery.value = "";
  aiBusy.value = false;
});
const reports = computed(() =>
  aiFilters.value
    ? aiReports.value
    : searchReports(
        data.reports,
        String(route.query.q || ""),
        data.siteName,
        filter.value,
      )
        .filter(
          (r) =>
            auth.user?.role !== "reporter" ||
            visibility.value === "all" ||
            r.visibility === visibility.value,
        )
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
);
async function searchAi() {
  if (!data.selectedSite || !aiQuery.value.trim()) return;
  const current = ++generation;
  aiBusy.value = true;
  aiError.value = "";
  aiNotice.value = "";
  try {
    const result = await request<{ filters: Filters; fallback: boolean }>(
      "/api/reports/search/nl",
      {
        method: "POST",
        body: JSON.stringify({
          siteId: data.selectedSite.id,
          query: aiQuery.value.trim(),
        }),
        timeoutMs: 180_000,
      },
    );
    if (current !== generation) return;
    aiFilters.value = result.filters;
    if (result.fallback)
      aiNotice.value = t("AI search unavailable; using text search.");
  } catch (error) {
    aiError.value = errorMessage(error);
  } finally {
    if (current === generation) aiBusy.value = false;
  }
}
function setFilter(event: Event) {
  const value = (event.target as HTMLSelectElement).value;
  router.replace({
    query: { ...route.query, status: value === "all" ? undefined : value },
  });
}
</script>
<template>
  <section class="ff-reports">
    <header class="ff-page-heading">
      <div>
        <p class="ff-context">{{ data.selectedSite?.name }}</p>
        <h1>
          {{
            t(auth.user?.role === "reporter" ? "All site reports" : "Reports")
          }}
        </h1>
      </div>
      <RouterLink
        v-if="data.canCreate && data.selectedSite"
        to="/reports/new"
        class="ff-primary"
        ><Plus :size="18" />{{ t("New report") }}</RouterLink
      >
    </header>
    <section class="ff-surface ff-report-browser">
      <div class="ff-browser-toolbar">
        <form class="ff-search-form" @submit.prevent="searchAi">
          <label for="report-search">{{ t("Search reports") }}</label>
          <div class="ff-search-row">
            <input
              id="report-search"
              v-model="aiQuery"
              maxlength="500"
              :placeholder="t('Describe the reports you need')"
            /><button
              class="ff-primary"
              :disabled="aiBusy || !aiQuery.trim() || !data.selectedSite"
            >
              {{ t(aiBusy ? "Searching…" : "Search with AI") }}
            </button>
          </div>
        </form>
        <div class="ff-browser-filters">
          <label v-if="!aiFilters"
            >{{ t("Status")
            }}<select :value="filter" @change="setFilter">
              <option value="all">{{ t("All reports") }}</option>
              <option value="open">{{ t("Open") }}</option>
              <option value="progress">{{ t("In progress") }}</option>
              <option value="resolved">{{ t("Resolved") }}</option>
              <option value="urgent">{{ t("Urgent") }}</option>
            </select></label
          ><label v-if="auth.user?.role === 'reporter'"
            >{{ t("Visibility")
            }}<select v-model="visibility">
              <option value="all">{{ t("All") }}</option>
              <option value="public">{{ t("Public") }}</option>
              <option value="private">{{ t("Private") }}</option>
            </select></label
          >
        </div>
      </div>
      <div v-if="aiFilters || route.query.q" class="ff-filter-chips">
        <button
          v-for="(value, key) in aiFilters"
          v-show="value"
          :key="key"
          @click="aiFilters = { ...aiFilters, [key]: null }"
        >
          {{ key }}: {{ value }} ×</button
        ><button
          v-if="aiFilters"
          class="ff-inline"
          @click="
            aiFilters = null;
            aiQuery = '';
            aiNotice = '';
          "
        >
          {{ t("Clear search") }}</button
        ><RouterLink
          v-if="route.query.q"
          :to="{ query: { ...route.query, q: undefined } }"
          >{{
            t("Search: {query}", { query: String(route.query.q) })
          }}
          ×</RouterLink
        >
      </div>
      <p v-if="aiNotice" class="ff-notice" role="status">{{ aiNotice }}</p>
      <p v-if="aiError" class="ff-alert" role="alert">{{ aiError }}</p>
      <header class="ff-results-heading">
        <h2>
          {{ t("Reports") }}
          <span v-if="data.reportsLoaded">{{
            t("{count} matching reports", { count: reports.length })
          }}</span>
        </h2>
        <p
          v-if="
            !aiFilters &&
            data.reportsLoaded &&
            data.reportPage + 1 < data.totalReportPages
          "
        >
          {{
            t(
              "Search and filters apply to loaded reports. Load more to include earlier reports.",
            )
          }}
        </p>
      </header>
      <ReportTable
        v-if="data.loading || (aiFilters && aiBusy && !aiReports.length)"
        :reports="[]"
        :loading-label="t('Loading reports…')"
      />
      <div
        v-else-if="data.reportsError && !data.reportsLoaded"
        class="ff-alert"
        role="alert"
      >
        {{ t(data.reportsError)
        }}<button @click="data.refresh()">{{ t("Retry") }}</button>
      </div>
      <template v-else-if="data.reportsLoaded"
        ><p v-if="data.reportsError" class="ff-alert" role="alert">
          {{ t(data.reportsError) }}
        </p>
        <ReportTable :reports="reports" />
        <footer
          v-if="
            aiFilters ? aiHasMore : data.reportPage + 1 < data.totalReportPages
          "
          class="ff-results-footer"
        >
          <button
            class="ff-secondary"
            :disabled="aiFilters ? aiBusy : data.loadingMore"
            @click="aiFilters ? loadAi(aiPage + 1) : data.loadMore()"
          >
            {{
              t(
                (aiFilters ? aiBusy : data.loadingMore)
                  ? "Loading reports…"
                  : "Load more reports",
              )
            }}
          </button>
        </footer></template
      >
      <p v-else class="ff-empty">
        {{ t("Select an accessible site to view its reports.") }}
      </p>
    </section>
  </section>
</template>
