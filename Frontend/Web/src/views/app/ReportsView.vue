<script setup lang="ts">
import { useAuthStore } from "@/stores/auth";
import { useLocale } from "@/i18n";
import { computed, ref, watch } from "vue";
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
const query = ref(String(route.query.q ?? ""));
watch(() => route.query.q, (value) => { query.value = String(value ?? ""); });
const reports = computed(() =>
  searchReports(data.reports, String(route.query.q ?? ""), data.siteName, filter.value)
    .filter((report) => auth.user?.role !== "reporter" || visibility.value === "all" || report.visibility === visibility.value)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
);
function search() {
  void router.replace({ query: { ...route.query, q: query.value.trim() || undefined } });
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
        <form class="ff-search-form" @submit.prevent="search">
          <label for="report-search">{{ t("Search reports") }}</label>
          <div class="ff-search-row">
            <input
              id="report-search"
              v-model="query"
              maxlength="500"
              :placeholder="t('Search by keyword')"
            /><button
              class="ff-primary"
              :disabled="!data.selectedSite"
            >
              {{ t("Search") }}
            </button>
          </div>
        </form>
        <div class="ff-browser-filters">
          <label
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
      <div v-if="route.query.q" class="ff-filter-chips">
        <RouterLink :to="{ query: { ...route.query, q: undefined } }">{{ t("Clear search") }}</RouterLink>
      </div>
      <header class="ff-results-heading">
        <h2>
          {{ t("Reports") }}
          <span v-if="data.reportsLoaded">{{
            t("{count} matching reports", { count: reports.length })
          }}</span>
        </h2>
        <p
          v-if="
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
        v-if="data.loading"
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
            data.reportPage + 1 < data.totalReportPages
          "
          class="ff-results-footer"
        >
          <button
            class="ff-secondary"
            :disabled="data.loadingMore"
            @click="data.loadMore()"
          >
            {{
              t(
                data.loadingMore
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
