<script setup lang="ts">
import LoadingStatus from "@/components/ui/LoadingStatus.vue";
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuth } from "@/composables/useAuth";
import { useMaintenanceStore } from "@/stores/maintenance";
import { useLocale } from "@/i18n";
import * as api from "@/services/siteDetails";
import { errorMessage } from "@/services/api";
import { humanize } from "@/utils/maintenance";
import type { Site, SiteRule } from "@/types/maintenance";
const { t } = useLocale();
const { user } = useAuth();
const route = useRoute();
const router = useRouter();
const data = useMaintenanceStore();
const siteId = computed(() => Number(route.params.siteId));
const allowed = computed(
  () =>
    user.value?.role === "super_admin" ||
    (["reporter", "staff", "admin"].includes(user.value?.role ?? "") &&
      user.value?.siteId === siteId.value),
);
const showPool = computed(
  () =>
    allowed.value &&
    ["staff", "admin", "super_admin"].includes(user.value?.role ?? ""),
);
const canManage = computed(
  () =>
    allowed.value && ["admin", "super_admin"].includes(user.value?.role ?? ""),
);
const site = ref<Site | null>(null);
const setup = ref<api.ReportingSetup | null>(null);
const taxonomy = ref<SiteRule[] | null>(null);
const pool = ref<api.SiteTechnician[] | null>(null);
const loading = ref(false);
const error = ref("");
const setupError = ref("");
const taxonomyError = ref("");
const poolError = ref("");
const removing = ref(false);
const typedName = ref("");
const busy = ref(false);
const removalError = ref("");
const confirmation = ref<HTMLElement>();
let generation = 0;
onBeforeUnmount(() => generation++);
async function load() {
  const current = ++generation;
  site.value = null;
  setup.value = null;
  taxonomy.value = null;
  pool.value = null;
  loading.value = false;
  error.value = "";
  setupError.value = "";
  taxonomyError.value = "";
  poolError.value = "";
  removing.value = false;
  typedName.value = "";
  removalError.value = "";
  busy.value = false;
  if (
    !allowed.value ||
    !Number.isSafeInteger(siteId.value) ||
    siteId.value <= 0
  ) {
    error.value = "This site is not available to your account.";
    return;
  }
  const id = siteId.value;
  loading.value = true;
  const results = await Promise.allSettled([
    api.getSite(id),
    api.getReportingSetup(id),
    api.getSiteTaxonomy(id),
    showPool.value ? api.getSiteTechnicians(id) : Promise.resolve(null),
  ]);
  if (current !== generation) return;
  const [details, readiness, categories, technicians] = results;
  if (details.status === "fulfilled" && details.value.id === id)
    site.value = details.value;
  else
    error.value =
      details.status === "rejected"
        ? errorMessage(details.reason)
        : "The site response did not match the requested site.";
  if (readiness.status === "fulfilled" && readiness.value.siteId === id)
    setup.value = readiness.value;
  else
    setupError.value =
      readiness.status === "rejected"
        ? errorMessage(readiness.reason)
        : "The setup response did not match the requested site.";
  if (categories.status === "fulfilled") taxonomy.value = categories.value;
  else taxonomyError.value = errorMessage(categories.reason);
  if (technicians.status === "fulfilled") pool.value = technicians.value;
  else poolError.value = errorMessage(technicians.reason);
  loading.value = false;
}
watch(
  [
    siteId,
    () => user.value?.id,
    () => user.value?.role,
    () => user.value?.siteId,
  ],
  load,
  { immediate: true },
);
async function askRemove() {
  removing.value = true;
  typedName.value = "";
  removalError.value = "";
  await nextTick();
  confirmation.value?.focus();
}
async function remove() {
  if (
    busy.value ||
    user.value?.role !== "super_admin" ||
    !site.value ||
    typedName.value !== site.value.name
  )
    return;
  const current = generation;
  const id = site.value.id;
  busy.value = true;
  removalError.value = "";
  try {
    await api.deleteSite(id);
    if (current !== generation) return;
    await data.refresh();
    if (current === generation) await router.replace("/sites");
  } catch (err) {
    if (current === generation) removalError.value = errorMessage(err);
  } finally {
    if (current === generation) busy.value = false;
  }
}
</script>
<template>
  <section class="live-page site-detail-page">
    <header class="site-detail-header">
      <RouterLink to="/sites" class="text-action"
        >← {{ t(user?.role === "reporter" ? "My site" : "Sites") }}</RouterLink
      >
    </header>
    <LoadingStatus v-if="loading" :label="t('Loading site details…')" />
    <p v-else-if="error" class="live-error" role="alert">{{ t(error) }} <button class="text-action" :disabled="loading" @click="load">{{ t("Retry") }}</button></p>
    <template v-else-if="site">
      <header class="dashboard-card site-profile-card">
        <div>
          <span class="site-detail-eyebrow"
            >{{ t("SITE PROFILE") }} · #{{ site.id }}</span
          >
          <h1>{{ site.name }}</h1>
          <p>{{ site.description || t("No description provided.") }}</p>
          <p class="site-address">
            {{ site.address || t("No address provided.") }}
          </p>
        </div>
        <dl class="site-facts">
          <div>
            <dt>{{ t("Site type") }}</dt>
            <dd>{{ t(humanize(site.type)) }}</dd>
          </div>
          <div v-if="user?.role !== 'reporter'">
            <dt>{{ t("Technician pool") }}</dt>
            <dd>{{ t(site.contractStatus === "contracted" ? "Site-contracted technicians" : "Open technician pool") }}</dd>
          </div>
          <div v-if="user?.role !== 'reporter'">
            <dt>{{ t("Contract flat fee") }}</dt>
            <dd>{{
              site.contractFlatFeeMinor == null
                ? t("Not set")
                : new Intl.NumberFormat(undefined, {
                    style: "currency",
                    currency: site.contractFeeCurrency || "USD",
                  }).format(site.contractFlatFeeMinor / 100)
            }}</dd>
          </div>
        </dl>
      </header>
      <div class="site-detail-grid">
        <section class="dashboard-card site-info-panel">
          <div class="section-heading">
            <span class="site-panel-icon">01</span>
            <div>
              <h2>{{ t("Reporting readiness") }}</h2>
              <p>{{ t("Make sure people can locate issues clearly.") }}</p>
            </div>
          </div>
          <p v-if="setupError" class="live-error" role="alert">
            {{ t(setupError) }}
          </p>
          <div
            v-else-if="setup"
            class="readiness-state"
            :class="setup.reportingReady ? 'ready' : 'needs-setup'"
          >
            <strong>{{
              t(
                setup.reportingReady
                  ? "Buildings are ready for reporting."
                  : "A labelled building is required before reporting.",
              )
            }}</strong
            ><span>{{
              t("{count} active buildings", { count: setup.activeSubsiteCount })
            }}</span>
          </div>
          <RouterLink
            class="text-action"
            :to="{ name: 'subsites', params: { siteId: site.id } }"
            >{{
              t(canManage ? "Manage buildings" : "View buildings")
            }}
            →</RouterLink
          >
        </section>
        <section class="dashboard-card site-info-panel">
          <div class="section-heading">
            <span class="site-panel-icon">02</span>
            <div>
              <h2>{{ t("Reporting categories") }}</h2>
              <p>{{ t("Categories currently available at this site.") }}</p>
            </div>
          </div>
          <p v-if="taxonomyError" class="live-error" role="alert">
            {{ t(taxonomyError) }}
          </p>
          <ul v-else-if="taxonomy?.length" class="taxonomy-list">
            <li v-for="rule in taxonomy" :key="rule.id">
              {{ t(humanize(rule.category)) }}
            </li>
          </ul>
          <p v-else>{{ t("No reporting categories are configured.") }}</p>
          <RouterLink v-if="canManage" to="/site-rules" class="text-action"
            >{{ t("Manage site category") }} →</RouterLink
          >
        </section>
        <section
          v-if="showPool"
          class="dashboard-card site-info-panel technician-pool"
        >
          <div class="section-heading">
            <span class="site-panel-icon">03</span>
            <div>
              <h2>{{ t("Available technician pool") }}</h2>
              <p>
                {{
                  t(
                    "Site-level availability; assignment also checks report requirements.",
                  )
                }}
              </p>
            </div>
          </div>
          <p v-if="poolError" class="live-error" role="alert">
            {{ t(poolError) }}
          </p>
          <ul v-else-if="pool?.length" class="pool-list">
            <li v-for="person in pool" :key="person.technicianId">
              <strong>{{ person.firstName }} {{ person.lastName }}</strong
              ><span>{{ person.email }}</span
              ><span
                >{{ t("Technician #{id}", { id: person.technicianId }) }} ·
                {{ t(humanize(person.availability)) }} ·
                {{ t(person.contracted ? "Contracted" : "Uncontracted") }}</span
              >
            </li>
          </ul>
          <p v-else>{{ t("No available technicians in this site pool.") }}</p>
        </section>
        <section
          v-if="user?.role === 'super_admin'"
          class="dashboard-card site-info-panel site-danger-zone"
        >
          <div class="section-heading">
            <span class="site-panel-icon">!</span>
            <div>
              <h2>{{ t("Delete site") }}</h2>
              <p>
                {{
                  t(
                    "Deletion cannot be undone and may be refused when related records exist.",
                  )
                }}
              </p>
            </div>
          </div>
          <button
            v-if="!removing"
            class="text-action"
            type="button"
            @click="askRemove"
          >
            {{ t("Review site deletion") }}
          </button>
          <section
            v-else
            ref="confirmation"
            tabindex="-1"
            class="site-removal"
            :aria-label="t('Delete site confirmation')"
          >
            <p>
              {{
                t(
                  "Permanently delete {name}? This cannot be undone. The server may refuse deletion while related records exist.",
                  { name: site.name },
                )
              }}
            </p>
            <form class="draft-form" @submit.prevent="remove">
              <p v-if="removalError" class="live-error" role="alert">
                {{ t(removalError) }}
              </p>
              <fieldset class="report-fields" :disabled="busy">
                <label
                  >{{ t("Type the exact site name to confirm")
                  }}<input v-model="typedName" required autocomplete="off"
                /></label>
                <div class="site-removal-actions">
                  <button
                    class="text-action"
                    type="submit"
                    :disabled="typedName !== site.name"
                  >
                    {{
                      t(busy ? "Deleting…" : "Delete site permanently")
                    }}</button
                  ><button
                    type="button"
                    class="text-action"
                    @click="removing = false"
                  >
                    {{ t("Cancel") }}
                  </button>
                </div>
              </fieldset>
            </form>
          </section>
        </section>
      </div>
    </template>
  </section>
</template>
<style scoped>
.site-detail-page {
  display: grid;
  gap: 18px;
}
.site-detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.site-profile-card {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 32px;
  padding: 28px;
}
.site-detail-eyebrow {
  color: #006f65;
  font-size: 10px;
  letter-spacing: 0.14em;
  font-weight: 750;
}
.site-profile-card h1 {
  margin: 10px 0;
  font-size: clamp(28px, 3vw, 38px);
  color: #152742;
}
.site-profile-card p {
  max-width: 680px;
  margin: 8px 0;
  color: #52677b;
  line-height: 1.65;
}
.site-address {
  font-size: 13px;
}
.site-facts {
  display: flex;
  gap: 28px;
  flex-wrap: wrap;
  margin: 0;
  padding: 15px 18px;
  border: 1px solid #e0e9e3;
  border-radius: 14px;
  background: #f8faf8;
}
.site-facts dt {
  font-size: 11px;
  color: #52677b;
}
.site-facts dd {
  margin: 5px 0 0;
  font-weight: 700;
}
.site-detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
.site-info-panel {
  padding: 24px;
}
.section-heading {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  margin-bottom: 18px;
}
.section-heading h2 {
  margin: 0;
  font-size: 18px;
  color: #152742;
}
.section-heading p {
  margin: 5px 0 0;
  color: #52677b;
  font-size: 13px;
  line-height: 1.5;
}
.site-panel-icon {
  display: grid;
  place-items: center;
  flex: 0 0 34px;
  height: 34px;
  border-radius: 11px;
  background: #d9f5ed;
  color: #006f65;
  font-size: 12px;
  font-weight: 750;
}
.readiness-state {
  display: grid;
  gap: 6px;
  margin-bottom: 16px;
  padding: 15px;
  border-radius: 12px;
  background: #edf7ee;
  color: #275d45;
}
.readiness-state.needs-setup {
  background: #fff6e7;
  color: #765817;
}
.taxonomy-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0;
  list-style: none;
}
.taxonomy-list li {
  padding: 8px 11px;
  border: 1px solid #dce7df;
  border-radius: 999px;
  background: #f8faf8;
  color: #33584c;
  font-size: 12px;
}
.pool-list {
  display: grid;
  gap: 12px;
  margin-top: 16px;
  padding: 0;
  list-style: none;
}
.pool-list li {
  display: grid;
  gap: 6px;
  border: 1px solid #dce7df;
  border-radius: 10px;
  padding: 16px;
  font-size: 13px;
  overflow-wrap: anywhere;
}
.site-danger-zone {
  border-color: #f1d5d0;
}
.site-removal {
  border: 1px solid #e2b7b7;
  background: #fff8f5;
  border-radius: 10px;
  padding: 20px;
  font-size: 13px;
  line-height: 1.8;
}
.site-removal-actions {
  display: flex;
  gap: 18px;
  flex-wrap: wrap;
}
@media (max-width: 800px) {
  .site-profile-card {
    flex-direction: column;
  }
  .site-detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>
