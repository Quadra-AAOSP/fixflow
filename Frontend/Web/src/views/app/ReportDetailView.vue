<script setup lang="ts">
import LoadingStatus from "@/components/ui/LoadingStatus.vue";
import { useLocale } from "@/i18n";
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowLeft, RefreshCw } from "@lucide/vue";
import { useAuth } from "@/composables/useAuth";
import { useMaintenanceStore } from "@/stores/maintenance";
import { useRealtimeStore } from "@/stores/realtime";
import * as api from "@/services/maintenance";
import { ApiError, errorMessage } from "@/services/api";
import {
  formatDate,
  humanize,
  statusLabels,
  statusTone,
  urgencyLabels,
} from "@/utils/maintenance";
import type { Report, ReportReporter } from "@/types/maintenance";
import type { Urgency } from "@/types";
import ReportAssistantPanel from "@/components/ReportAssistantPanel.vue";
import ReportPhotosPanel from "@/components/ReportPhotosPanel.vue";
import TechnicianAssignmentPanel from "@/components/technician/TechnicianAssignmentPanel.vue";
import MarketplacePublishPanel from "@/components/technician/MarketplacePublishPanel.vue";
import ReportWorkPanel from "@/components/ReportWorkPanel.vue";
import ReportReviewPanel from "@/components/ReportReviewPanel.vue";
import ReportWorkflowPanel from "@/components/ReportWorkflowPanel.vue";
import ReportClassificationPanel from "@/components/ReportClassificationPanel.vue";
import ReportVisionPanel from "@/components/ReportVisionPanel.vue";
const { t } = useLocale();

const route = useRoute();
const router = useRouter();
const { user } = useAuth();
const data = useMaintenanceStore();
const realtime = useRealtimeStore();
const report = ref<Report | null>(null);
const reporters = ref<ReportReporter[]>([]);
const reportersLoaded = ref(false);
const reportersError = ref("");
const loading = ref(false);
const error = ref("");
const actionError = ref("");
const message = ref("");
const busy = ref(false);
const edit = ref<api.ReportEdit | null>(null);
const confirmingArchive = ref(false);
const assignmentBusy = ref(false);
const reviewBusy = ref(false);
const workflowBusy = ref(false);
const classificationBusy = ref(false);
const visionBusy = ref(false);
const marketplaceBusy = ref(false);
const workBusy = ref(false);
const resolutionDraft = ref("");
const actionInProgress = computed(
  () =>
    busy.value ||
    workflowBusy.value ||
    assignmentBusy.value ||
    reviewBusy.value ||
    classificationBusy.value ||
    visionBusy.value ||
    marketplaceBusy.value ||
    workBusy.value,
);
type TechnicianRoute = "contracted" | "marketplace";
const technicianRoute = ref<TechnicianRoute>("contracted");
const technicianRoutes = computed(() => {
  if (
    !report.value ||
    ["confirmed", "resolved_pending_confirmation"].includes(report.value.status)
  )
    return [];
  const role = user.value?.role;
  const manager = role === "admin" || role === "super_admin";
  const choices: TechnicianRoute[] = [];
  if (report.value.policy?.canAssign ?? (manager || role === "staff"))
    choices.push("contracted");
  if (
    role === "admin" &&
    user.value?.siteId === report.value.siteId &&
    report.value.assignedTechnicianId === null &&
    ["open", "routed", "reopened", "escalated"].includes(report.value.status)
  ) {
    choices.push("marketplace");
  }
  return choices;
});
watch(
  [technicianRoutes, () => report.value?.id],
  ([choices]) => {
    if (!choices.includes(technicianRoute.value))
      technicianRoute.value = choices[0] ?? "contracted";
  },
  { immediate: true },
);
let generation = 0;
onBeforeUnmount(() => {
  generation++;
  realtime.setReport(null);
});
watch(report, (value) => realtime.setReport(value));
watch(
  () => realtime.accessRevision,
  () => {
    if (realtime.accessReason !== "disconnect") resolutionDraft.value = "";
    generation++;
    report.value = null;
    reporters.value = [];
    reportersLoaded.value = false;
    reportersError.value = "";
    actionError.value = "";
    message.value = "";
    loading.value = false;
    error.value =
      "Report access is being rechecked. Reload if the connection remains unavailable.";
  },
  { flush: "sync" },
);
watch(
  () => realtime.refreshRevision,
  () => {
    if (
      realtime.changedReportIds === null ||
      realtime.changedReportIds.includes(Number(route.params.id))
    )
      void load(true);
  },
);
const joined = computed(() =>
  reporters.value.some((item) => item.userId === user.value?.id),
);
async function loadReporters(id: number, version: number) {
  try {
    const result = await api.listReporters(id);
    if (version !== generation) return;
    reporters.value = result;
    reportersLoaded.value = true;
  } catch (err) {
    if (version !== generation) return;
    if (!(err instanceof ApiError && err.status === 403))
      reportersError.value = errorMessage(err);
  }
}
async function load(background = false) {
  const version = ++generation;
  const id = Number(route.params.id);
  background = background && report.value?.id === id;
  const snapshot = report.value;
  if (!background) {
    report.value = null;
    reporters.value = [];
    reportersLoaded.value = false;
    reportersError.value = "";
    error.value = "";
    actionError.value = "";
    message.value = "";
    loading.value = true;
    edit.value = null;
    confirmingArchive.value = false;
  }
  if (!Number.isSafeInteger(id) || id <= 0) {
    error.value = "Invalid report ID.";
    loading.value = false;
    return;
  }
  try {
    const result = await api.getReport(id);
    if (version !== generation) return;
    if (background && report.value !== snapshot) return;
    report.value = result;
    data.upsert(result);
    await loadReporters(id, version);
  } catch (err) {
    if (version !== generation) return;
    if (
      !background ||
      (err instanceof ApiError &&
        (err.status === 401 || err.status === 403 || err.status === 404))
    ) {
      resolutionDraft.value = "";
      report.value = null;
      reporters.value = [];
      reportersLoaded.value = false;
      error.value = errorMessage(err);
    }
  } finally {
    if (version === generation) loading.value = false;
  }
}
watch(
  [() => route.params.id, () => user.value?.id, () => user.value?.role],
  () => {
    resolutionDraft.value = "";
    void load();
  },
  { immediate: true },
);
function beginEdit() {
  if (!report.value) return;
  const { description, address, reporterUrgency, reporterReason } =
    report.value;
  edit.value = { description, address, reporterUrgency, reporterReason };
  confirmingArchive.value = false;
}
async function saveEdit() {
  if (!report.value || !edit.value || busy.value) return;
  const version = generation;
  busy.value = true;
  actionError.value = "";
  message.value = "";
  try {
    const saved = await api.updateReport(report.value.id, edit.value);
    if (generation !== version) return;
    report.value = saved;
    data.upsert(saved);
    edit.value = null;
    message.value = "Report updated.";
  } catch (err) {
    if (generation === version) actionError.value = errorMessage(err);
  } finally {
    busy.value = false;
  }
}
async function archiveReport() {
  if (!report.value || busy.value) return;
  const version = generation;
  busy.value = true;
  actionError.value = "";
  try {
    await api.deleteReport(report.value.id);
    if (generation !== version) return;
    await router.replace("/reports");
    void data.refresh();
  } catch (err) {
    if (generation === version) actionError.value = errorMessage(err);
  } finally {
    busy.value = false;
  }
}
async function join() {
  if (!report.value || busy.value) return;
  const id = report.value.id;
  const version = generation;
  busy.value = true;
  actionError.value = "";
  message.value = "";
  try {
    const result = await api.joinReport(id);
    if (version !== generation) return;
    report.value = result;
    data.upsert(result);
    message.value = "You are now attached to this report.";
    await loadReporters(id, version);
  } catch (err) {
    if (version === generation) actionError.value = errorMessage(err);
  } finally {
    busy.value = false;
  }
}
function workflowSaved(saved: Report) {
  report.value = saved;
  data.upsert(saved);
  message.value = "Repair workflow updated by the service.";
}
async function leave() {
  if (!report.value || busy.value) return;
  const id = report.value.id;
  const version = generation;
  busy.value = true;
  actionError.value = "";
  message.value = "";
  try {
    const result = await api.leaveReport(id);
    if (version !== generation) return;
    report.value = result;
    data.upsert(result);
    message.value = "You left this report.";
    await loadReporters(id, version);
  } catch (err) {
    if (version === generation) actionError.value = errorMessage(err);
  } finally {
    busy.value = false;
  }
}
const overrideUrgency = ref<Urgency>("medium");
const overrideReason = ref("");
async function saveUrgencyOverride() {
  if (!report.value || busy.value) return;
  const version = generation;
  busy.value = true;
  actionError.value = "";
  message.value = "";
  try {
    const result = await api.overrideUrgency(
      report.value.id,
      overrideUrgency.value,
      overrideReason.value,
    );
    if (version !== generation) return;
    report.value = result;
    data.upsert(result);
    overrideReason.value = "";
    message.value = "Final urgency updated.";
  } catch (err) {
    if (version === generation) actionError.value = errorMessage(err);
  } finally {
    busy.value = false;
  }
}
const canLeave = computed(
  () =>
    user.value?.role === "reporter" &&
    joined.value &&
    user.value.id !== report.value?.createdByUserId,
);
const canOverrideUrgency = computed(
  () =>
    !!report.value &&
    report.value.status !== "confirmed" &&
    (user.value?.role === "staff" ||
      user.value?.role === "admin" ||
      user.value?.role === "super_admin"),
);
function assigned(saved: Report) {
  report.value = saved;
  data.upsert(saved);
  message.value = "Technician assignment saved.";
}
function workSaved(saved: Report) {
  report.value = saved;
  data.upsert(saved);
  message.value = "Work status updated.";
}
function reviewed(saved: Report) {
  report.value = saved;
  data.upsert(saved);
  message.value =
    saved.status === "confirmed"
      ? "The issue is confirmed as fixed."
      : "The report was reopened for further work.";
}
function classified(saved: Report) {
  report.value = saved;
  data.upsert(saved);
  message.value = "Classification refreshed from the service.";
}
async function visionFinished(id: number) {
  const current = generation;
  const snapshot = report.value;
  if (report.value?.id !== id) return;
  try {
    const saved = await api.getReport(id);
    if (current === generation && report.value === snapshot) {
      report.value = saved;
      data.upsert(saved);
    }
  } catch (err) {
    if (current === generation && report.value === snapshot)
      actionError.value = errorMessage(err);
  }
}
</script>
<template>
  <section class="report-detail-page">
    <div class="detail-toolbar">
      <div class="card-heading">
        <RouterLink class="text-action" to="/reports"
          ><ArrowLeft :size="16" />{{ t("All reports") }}</RouterLink
        ><button
          class="icon-button"
          :disabled="loading || actionInProgress"
          :aria-label="t('Reload report')"
          @click="load()"
        >
          <RefreshCw :size="17" />
        </button>
      </div>
    </div>
    <div class="detail-surface">
      <LoadingStatus v-if="loading" :label="t('Loading report…')" />
      <p v-else-if="error" role="alert" class="live-error">{{ t(error) }}</p>
      <template v-else-if="report">
        <header class="detail-title">
          <div>
            <p class="detail-site">{{ data.siteName(report.siteId) }}</p>
            <h1>{{ t("Report #{id}", { id: report.id }) }}</h1>
          </div>
          <span class="status-badge" :class="statusTone(report.status)">{{
            t(statusLabels[report.status])
          }}</span>
        </header>
        <div class="detail-layout">
          <div class="detail-main">
            <p class="report-description">{{ report.description }}</p>
            <details class="detail-summary report-disclosure" open>
              <summary>{{ t("Report information") }}</summary>
              <dl class="report-detail-grid">
                <div v-if="report.visibility">
                  <dt>{{ t("Report visibility") }}</dt>
                  <dd>
                    {{
                      t(
                        report.visibility === "private"
                          ? "Private report"
                          : "Public within your site",
                      )
                    }}
                  </dd>
                </div>
                <div>
                  <dt>{{ t("Site") }}</dt>
                  <dd>{{ data.siteName(report.siteId) }}</dd>
                </div>
                <div>
                  <dt>{{ t("Location") }}</dt>
                  <dd>
                    {{ report.address || t("Not shared or not provided") }}
                  </dd>
                </div>
                <div>
                  <dt>{{ t("Category") }}</dt>
                  <dd>{{ t(humanize(report.category)) }}</dd>
                </div>
                <div>
                  <dt>{{ t("Specialty") }}</dt>
                  <dd>
                    {{
                      report.specialty
                        ? t(humanize(report.specialty))
                        : t("Not specified")
                    }}
                  </dd>
                </div>
                <div>
                  <dt>{{ t("Reported by") }}</dt>
                  <dd>{{ report.createdByName || t("Not shared") }}</dd>
                </div>
                <div>
                  <dt>{{ t("Technician") }}</dt>
                  <dd>
                    {{
                      report.assignedTechnicianId == null
                        ? t("Unassigned")
                        : t("Technician #{id}", {
                            id: report.assignedTechnicianId,
                          })
                    }}
                  </dd>
                </div>
                <div>
                  <dt>{{ t("Reporter urgency") }}</dt>
                  <dd>{{ t(urgencyLabels[report.reporterUrgency]) }}</dd>
                </div>
                <div>
                  <dt>{{ t("Calculated urgency") }}</dt>
                  <dd>
                    {{
                      report.calculatedUrgency
                        ? t(urgencyLabels[report.calculatedUrgency])
                        : t("Not determined")
                    }}
                  </dd>
                </div>
                <div>
                  <dt>{{ t("People joined") }}</dt>
                  <dd>{{ report.participationCount ?? reporters.length }}</dd>
                </div>
                <div>
                  <dt>{{ t("AI urgency") }}</dt>
                  <dd>
                    {{
                      report.aiUrgency
                        ? t(urgencyLabels[report.aiUrgency])
                        : t("Not classified")
                    }}
                  </dd>
                </div>
                <div>
                  <dt>{{ t("Final urgency") }}</dt>
                  <dd>
                    {{
                      report.finalUrgency
                        ? t(urgencyLabels[report.finalUrgency])
                        : t("Not determined")
                    }}
                  </dd>
                </div>
                <div>
                  <dt>{{ t("Urgency reason") }}</dt>
                  <dd>
                    {{
                      report.reporterReason || t("Not shared or not provided")
                    }}
                  </dd>
                </div>
                <div>
                  <dt>{{ t("Created") }}</dt>
                  <dd>{{ formatDate(report.createdAt, true) }}</dd>
                </div>
                <div>
                  <dt>{{ t("Updated") }}</dt>
                  <dd>{{ formatDate(report.updatedAt, true) }}</dd>
                </div>
                <div>
                  <dt>{{ t("Times reopened") }}</dt>
                  <dd>{{ report.reopenCount }}</dd>
                </div>
              </dl>
            </details>
            <p v-if="message" class="draft-notice" role="status">
              {{ t(message) }}
            </p>
            <p v-if="actionError" class="live-error" role="alert">
              {{ t(actionError) }}
            </p>
            <details
              v-if="report.policy?.canEdit || report.policy?.canDelete"
              class="detail-section report-disclosure"
            >
              <summary>{{ t("Report actions") }}</summary>
              <div class="card-heading">
                <button
                  v-if="report.policy?.canEdit && !edit"
                  class="text-action"
                  :disabled="actionInProgress"
                  @click="beginEdit"
                >
                  {{ t("Edit report") }}
                </button>
                <button
                  v-if="report.policy?.canDelete && !confirmingArchive"
                  class="text-action"
                  :disabled="actionInProgress"
                  @click="
                    edit = null;
                    confirmingArchive = true;
                  "
                >
                  {{ t("Archive report") }}
                </button>
              </div>
              <form v-if="edit" class="draft-form" @submit.prevent="saveEdit">
                <fieldset class="report-fields" :disabled="actionInProgress">
                  <label
                    >{{ t("Description")
                    }}<textarea
                      v-model="edit.description"
                      required
                      maxlength="10000"
                      rows="4"
                    />
                  </label>
                  <label
                    >{{ t("Address")
                    }}<input v-model="edit.address" maxlength="512"
                  /></label>
                  <label
                    >{{ t("Reporter urgency")
                    }}<select v-model="edit.reporterUrgency">
                      <option
                        v-for="(label, value) in urgencyLabels"
                        :key="value"
                        :value="value as Urgency"
                      >
                        {{ t(label) }}
                      </option>
                    </select></label
                  >
                  <label
                    >{{ t("Urgency reason")
                    }}<textarea
                      v-model="edit.reporterReason"
                      maxlength="2000"
                      rows="3"
                    />
                  </label>
                  <button class="report-issue-button" type="submit">
                    {{ t("Save changes") }}
                  </button>
                  <button
                    class="text-action"
                    type="button"
                    @click="edit = null"
                  >
                    {{ t("Cancel") }}
                  </button>
                </fieldset>
              </form>
              <div v-if="confirmingArchive">
                <p class="dialog-intro">
                  {{
                    t(
                      "Archiving removes this report from default lists and notifies joined people and other participants. Existing records and access permissions are retained.",
                    )
                  }}
                </p>
                <button
                  class="report-issue-button"
                  type="button"
                  :disabled="actionInProgress"
                  @click="archiveReport"
                >
                  {{ t("Confirm archive") }}
                </button>
                <button
                  class="text-action"
                  type="button"
                  :disabled="actionInProgress"
                  @click="confirmingArchive = false"
                >
                  {{ t("Cancel") }}
                </button>
              </div>
            </details>
            <details class="detail-section report-disclosure">
              <summary>{{ t("People attached to this report") }}</summary>
              <p v-if="reportersError" class="live-error">
                {{ t(reportersError) }}
              </p>
              <ul v-else-if="reportersLoaded" class="reporter-list">
                <li v-for="person in reporters" :key="person.userId">
                  {{
                    person.userId === user?.id
                      ? t("You")
                      : person.name || t("User #{id}", { id: person.userId })
                  }}<span>{{
                    t("Joined {date}", {
                      date: formatDate(person.joinedAt, true),
                    })
                  }}</span>
                </li>
              </ul>
              <p v-else class="dialog-intro">
                {{
                  t(
                    "Reporter identities are only available to people with access to this report.",
                  )
                }}
              </p>
              <button
                v-if="user?.role === 'reporter' && !joined"
                class="report-issue-button"
                :disabled="actionInProgress"
                @click="join"
              >
                {{ t(busy ? "Saving…" : "This issue affects me too") }}
              </button>
              <p
                v-if="user?.role === 'reporter' && !joined"
                class="dialog-intro"
              >
                {{
                  t(
                    "Joining attaches your account to the report and gives you access to its shared details.",
                  )
                }}
              </p>
              <button
                v-if="canLeave"
                class="text-action"
                :disabled="actionInProgress"
                @click="leave"
              >
                {{ t(busy ? "Leaving…" : "Leave report") }}
              </button>
            </details>
            <details
              v-if="canOverrideUrgency"
              class="detail-section secondary-tool"
            >
              <summary>{{ t("Override urgency") }}</summary>
              <p class="dialog-intro">
                {{
                  t(
                    "Manual final urgency takes precedence over reporter and join-based calculated urgency. Join boosts never reach Critical.",
                  )
                }}
              </p>
              <form class="draft-form" @submit.prevent="saveUrgencyOverride">
                <fieldset class="report-fields" :disabled="actionInProgress">
                  <label
                    >{{ t("Final urgency")
                    }}<select v-model="overrideUrgency">
                      <option
                        v-for="(label, value) in urgencyLabels"
                        :key="value"
                        :value="value as Urgency"
                      >
                        {{ t(label) }}
                      </option>
                    </select></label
                  >
                  <label
                    >{{ t("Override reason")
                    }}<textarea
                      v-model="overrideReason"
                      required
                      maxlength="500"
                      rows="3"
                    />
                  </label>
                  <button class="report-issue-button" type="submit">
                    {{ t(busy ? "Saving…" : "Save urgency override") }}
                  </button>
                </fieldset>
              </form>
            </details>
            <div
              v-if="report.confirmedAt || report.reopenReason"
              class="detail-section"
            >
              <p v-if="report.confirmedAt">
                {{
                  report.confirmedByName
                    ? t("Confirmed {date} by {name}", {
                        date: formatDate(report.confirmedAt, true),
                        name: report.confirmedByName,
                      })
                    : t("Confirmed {date}", {
                        date: formatDate(report.confirmedAt, true),
                      })
                }}
              </p>
              <p v-if="report.reopenReason">
                {{
                  t("Reopen reason: {reason}", { reason: report.reopenReason })
                }}
              </p>
            </div>
            <details class="secondary-tool">
              <summary>{{ t("AI classification") }}</summary>
              <ReportClassificationPanel
                :report="report"
                :disabled="actionInProgress"
                @busy="classificationBusy = $event"
                @saved="classified"
              />
            </details>
            <details class="secondary-tool">
              <summary>{{ t("Analyze one image") }}</summary>
              <ReportVisionPanel
                :report="report"
                :disabled="actionInProgress"
                @busy="visionBusy = $event"
                @finished="visionFinished"
              />
            </details>
            <details class="report-disclosure"><summary>{{ t("Repair workflow") }}</summary>
            <ReportWorkflowPanel
              supplementary
              :report="report"
              :disabled="actionInProgress"
              @busy="workflowBusy = $event"
              @saved="workflowSaved"
            />
            </details>
          </div>
          <aside class="detail-workflow">
            <details class="report-disclosure" open><summary>{{ t("Work and resolution") }}</summary>
            <ReportReviewPanel
              :report="report"
              :disabled="actionInProgress"
              @busy="reviewBusy = $event"
              @saved="reviewed"
            />
            <ReportWorkPanel
              v-model:description="resolutionDraft"
              :report="report"
              :disabled="actionInProgress"
              @busy="workBusy = $event"
              @saved="workSaved"
            />
            </details>
            <details v-if="technicianRoutes.length" class="detail-section report-disclosure">
              <summary>{{ t("Find a technician") }}</summary>
              <label class="ranking-route"
                >{{ t("Technician route") }}
                <select v-model="technicianRoute" :disabled="actionInProgress">
                  <option
                    v-if="technicianRoutes.includes('contracted')"
                    value="contracted"
                  >
                    {{ t("Assign a contracted technician") }}
                  </option>
                  <option
                    v-if="technicianRoutes.includes('marketplace')"
                    value="marketplace"
                  >
                    {{ t("Publish to the job marketplace") }}
                  </option>
                </select>
              </label>
              <p class="dialog-intro">
                {{
                  t(
                    technicianRoute === "contracted"
                      ? "Choose a technician already contracted to this site."
                      : "Publish a job so eligible independent technicians can apply for this report.",
                  )
                }}
              </p>
              <TechnicianAssignmentPanel
                v-show="technicianRoute === 'contracted'"
                :report="report"
                :disabled="actionInProgress"
                @busy="assignmentBusy = $event"
                @saved="assigned"
              />
              <MarketplacePublishPanel
                v-show="technicianRoute === 'marketplace'"
                :report="report"
                :disabled="actionInProgress"
                @busy="marketplaceBusy = $event"
              />
            </details>
          </aside>
        </div>
        <div class="detail-support">
          <details class="report-disclosure"><summary>{{ t("Report photos") }}</summary><ReportPhotosPanel :report="report" /></details>
          <details class="secondary-tool">
            <summary>{{ t("Report assistant") }}</summary>
            <ReportAssistantPanel :report="report" />
          </details>
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
.report-disclosure > summary, .secondary-tool > summary { cursor:pointer; min-height:44px; padding:12px 16px; border:1px solid #b6c8bf; border-radius:8px; background:#f5f9f7; color:#006f65; font-size:16px; font-weight:650; }
.report-disclosure > summary:focus-visible, .secondary-tool > summary:focus-visible { outline:2px solid #00766b; outline-offset:3px; }
.report-disclosure[open] > summary, .secondary-tool[open] > summary { margin-bottom:16px; }
.report-disclosure { min-width:0; }

.report-detail-page {
  display: grid;
  gap: 20px;
}
.detail-toolbar {
  padding: 8px 0 16px;
  border-bottom: 1px solid #e0e9e4;
}
.detail-toolbar .card-heading {
  margin: 0;
}
.detail-surface {
  background: white;
  border: 1px solid #e1e9e5;
  border-radius: 14px;
  padding: 26px;
}
.detail-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding-bottom: 22px;
  margin-bottom: 22px;
  border-bottom: 1px solid #e1ebe5;
}
.detail-title h1 {
  font-size: 30px;
  font-weight: 700;
  letter-spacing: -0.03em;
}
.detail-site {
  color: #006f65;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 6px;
}
.detail-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);
  gap: 28px;
  align-items: start;
}
.detail-main,
.detail-workflow {
  min-width: 0;
}
.detail-summary {
  background: #f5f9f7;
  border: 1px solid #e1ebe5;
  border-radius: 10px;
  padding: 22px;
}
.detail-summary h1 {
  font-size: 27px;
  font-weight: 700;
  letter-spacing: -0.03em;
}
.detail-summary .report-description {
  line-height: 1.6;
}
.detail-summary .operation-subheading {
  margin-top: 22px;
  font-size: 16px;
  font-weight: 700;
}
.detail-summary .report-detail-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
  padding-bottom: 0;
}
.detail-workflow {
  background: #fafcfb;
  border: 1px solid #e1ebe5;
  border-radius: 10px;
  padding: 22px;
}
.detail-workflow-heading {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 18px;
}
.detail-support {
  display: grid;
  align-items: start;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
  margin-top: 24px;
}
.detail-support > * {
  min-width: 0;
}
.ranking-route {
  display: grid;
  gap: 0.5rem;
  max-width: 32rem;
  margin-top: 1rem;
}
.ranking-route select {
  color: #152742;
  background: #fff;
  width: 100%;
  border: 1px solid #dfe8e2;
  border-radius: 8px;
  padding: 0.75rem;
}
@media (max-width: 1050px) {
  .detail-layout,
  .detail-support {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 650px) {
  .detail-surface {
    padding: 16px;
  }
  .detail-summary,
  .detail-workflow {
    padding: 16px;
  }
  .detail-summary .report-detail-grid {
    grid-template-columns: 1fr;
  }
}
.secondary-tool {
  border: 1px solid #dce5e4;
  border-radius: 10px;
  padding: 18px;
  margin-top: 18px;
  min-width: 0;
}
.secondary-tool > summary {
  cursor: pointer;
  font-size: 14px;
  font-weight: 650;
  color: #006f65;
}
.secondary-tool[open] > summary {
  margin-bottom: 18px;
}
</style>
