<script setup lang="ts">
import LoadingStatus from "@/components/ui/LoadingStatus.vue";
import { useLocale } from "@/i18n";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { ArrowLeft, ArrowRight } from "@lucide/vue";
import { useAuth } from "@/composables/useAuth";
import { useMaintenanceStore } from "@/stores/maintenance";
import {
  createReport,
  createReportWithPhotos,
  listSubsites,
  requestSubsiteAddition,
} from "@/services/maintenance";
import {
  REPORT_PHOTO_LIMIT,
  REPORT_PHOTO_TYPES,
  validateReportPhoto,
} from "@/services/reportPhotos";
import { ApiError, errorMessage } from "@/services/api";
import { humanize, urgencyLabels } from "@/utils/maintenance";
import type { ReportVisibility, Subsite } from "@/types/maintenance";
import type { Urgency } from "@/types";
const { t } = useLocale();

const data = useMaintenanceStore();
const { user } = useAuth();
const router = useRouter();
const description = ref("");
const address = ref("");
const category = ref("");
const specialty = ref("");
const visibility = ref<ReportVisibility>("public");
const urgency = ref<Urgency | "">("");
const reason = ref("");
const subsiteId = ref<number | "suggested" | null>(null);
const suggestedLocation = ref<{ id: number; name: string } | null>(null);
const subsites = ref<Subsite[]>([]);
const locationsLoading = ref(false);
const locationsError = ref("");
const requestNote = ref("");
const showSuggestion = ref(false);
const suggestionInput = ref<HTMLInputElement>();
async function openSuggestion() {
  showSuggestion.value = true;
  await nextTick();
  suggestionInput.value?.focus();
}
const requestBusy = ref(false);
const requestError = ref("");
const requestSent = ref(false);
const submitting = ref(false);
const error = ref("");
const photos = ref<File[]>([]);
const photoInput = ref<HTMLInputElement>();
const photoError = ref("");
const saved = ref(false);
const hasUnsavedChanges = computed(() => !saved.value && !!user.value && (
  description.value.trim() || address.value.trim() || category.value || specialty.value.trim() ||
  urgency.value || reason.value.trim() || visibility.value !== "public" || photos.value.length ||
  (!requestSent.value && requestNote.value.trim())
));
const removeLeaveGuard = router.beforeEach(() => !hasUnsavedChanges.value || window.confirm(t("Leave this report? Your unsaved changes will be lost.")));
function warnBeforeUnload(event: BeforeUnloadEvent) {
  if (!hasUnsavedChanges.value) return;
  event.preventDefault();
  event.returnValue = "";
}
onMounted(() => window.addEventListener("beforeunload", warnBeforeUnload));
onBeforeUnmount(() => {
  removeLeaveGuard();
  window.removeEventListener("beforeunload", warnBeforeUnload);
});

function clearPhotos() {
  photos.value = [];
  photoError.value = "";
  if (photoInput.value) photoInput.value.value = "";
}
function selectPhotos(event: Event) {
  photos.value = [];
  photoError.value = "";
  const selected = Array.from((event.target as HTMLInputElement).files ?? []);
  try {
    if (selected.length > REPORT_PHOTO_LIMIT)
      throw new Error("Choose up to 1 photo.");
    selected.forEach(validateReportPhoto);
    photos.value = selected;
  } catch (err) {
    photoError.value = errorMessage(err);
    if (photoInput.value) photoInput.value.value = "";
  }
}
const categories = computed(() => [
  ...new Set(data.rules.map((rule) => rule.category)),
]);
const canManageBuildings = computed(
  () => user.value?.role === "super_admin" || user.value?.role === "admin",
);
let disposed = false;
let siteLoad = 0;
let suggestionVersion = 0;
onBeforeUnmount(() => {
  disposed = true;
  siteLoad++;
  suggestionVersion++;
});

async function loadLocations(id: number | null, preserveSelection = false) {
  const current = ++siteLoad;
  const previousId = preserveSelection ? subsiteId.value : null;
  subsiteId.value = null;
  subsites.value = [];
  locationsError.value = "";
  locationsLoading.value = false;
  if (!id) return;
  locationsLoading.value = true;
  try {
    const result = await listSubsites(id);
    if (current === siteLoad) {
      subsites.value = result.filter((item) => !item.archivedAt);
      if (subsites.value.some((item) => item.id === previousId))
        subsiteId.value = previousId;
      else if (subsites.value.length === 1)
        subsiteId.value = subsites.value[0]!.id;
    }
  } catch (err) {
    if (current === siteLoad) locationsError.value = errorMessage(err);
  } finally {
    if (current === siteLoad) locationsLoading.value = false;
  }
}
watch(
  () => data.selectedSiteId,
  (id) => {
    clearPhotos();
    suggestionVersion++;
    requestBusy.value = false;
    category.value = "";
    error.value = "";
    requestNote.value = "";
    requestError.value = "";
    requestSent.value = false;
    suggestedLocation.value = null;
    showSuggestion.value = false;
    void loadLocations(id);
  },
  { immediate: true },
);
watch(categories, (values) => {
  if (!values.includes(category.value)) category.value = "";
});

async function requestLocation() {
  const siteId = data.selectedSiteId;
  if (!siteId || requestBusy.value || requestSent.value) return;
  const version = ++suggestionVersion;
  requestError.value = "";
  requestBusy.value = true;
  try {
    const requestedName = requestNote.value.trim();
    const receipt = await requestSubsiteAddition(siteId, requestedName);
    if (
      !disposed &&
      version === suggestionVersion &&
      data.selectedSiteId === siteId
    ) {
      requestSent.value = true;
      suggestedLocation.value = { id: receipt.id, name: requestedName };
      subsiteId.value = "suggested";
      showSuggestion.value = false;
    }
  } catch (err) {
    if (
      !disposed &&
      version === suggestionVersion &&
      data.selectedSiteId === siteId
    )
      requestError.value = errorMessage(err);
  } finally {
    if (version === suggestionVersion) requestBusy.value = false;
  }
}

async function submit() {
  if (submitting.value || photoError.value) return;
  error.value = "";
  const siteId = data.selectedSiteId;
  if (
    !data.canCreate ||
    !siteId ||
    !description.value.trim() ||
    !categories.value.includes(category.value) ||
    !urgency.value ||
    !(subsiteId.value === "suggested" ? suggestedLocation.value : subsites.value.some((item) => item.id === subsiteId.value))
  ) {
    error.value =
      "Choose a site, building, category, and urgency, and describe the issue.";
    return;
  }
  const locationAddress = subsiteId.value === "suggested" && suggestedLocation.value
    ? [suggestedLocation.value.name, address.value.trim()].filter(Boolean).join(' · ')
    : address.value.trim();
  if (locationAddress.length > 512) { error.value = "Building name and exact location must fit within 512 characters."; return; }
  const payload = {
    siteId,
    subsiteId: typeof subsiteId.value === "number" ? subsiteId.value : undefined,
    description: description.value.trim(),
    address: locationAddress || undefined,
    category: category.value,
    specialty: specialty.value.trim() || undefined,
    visibility: visibility.value,
    reporterUrgency: urgency.value,
    reporterReason: reason.value.trim() || undefined,
  };
  const actorId = user.value?.id;
  submitting.value = true;
  try {
    const report = photos.value.length
      ? await createReportWithPhotos(payload, photos.value)
      : await createReport(payload);
    if (
      disposed ||
      user.value?.id !== actorId ||
      data.selectedSiteId !== siteId
    )
      return;
    data.upsert(report);
    saved.value = true;
    await router.replace({ name: "report-detail", params: { id: report.id } });
  } catch (err) {
    if (
      disposed ||
      user.value?.id !== actorId ||
      data.selectedSiteId !== siteId
    )
      return;
    error.value = errorMessage(err);
    if (err instanceof ApiError && err.status === 409)
      await loadLocations(siteId);
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <section class="report-create">
    <header class="create-header">
      <RouterLink class="text-action" to="/reports"
        ><ArrowLeft :size="16" />{{ t("All reports") }}</RouterLink
      >
      <h1>{{ t("Report an issue") }}</h1>
      <p class="dialog-intro">
        {{
          t(
            "Describe what needs attention at {site}. Your report will be saved to the maintenance system.",
            { site: data.selectedSite?.name || t("your site") },
          )
        }}
      </p>
    </header>
    <div class="create-surface">
      <p v-if="!data.canCreate" class="live-empty">
        {{ t("Your account cannot create reports.") }}
      </p>
      <LoadingStatus
        v-else-if="data.loading"
        :label="t('Loading site categories…')"
      />
      <p v-else-if="data.rulesError" class="live-error" role="alert">
        {{ t(data.rulesError) }}
        <button @click="data.refresh()">{{ t("Retry") }}</button>
      </p>
      <p
        v-else-if="!data.selectedSite || !categories.length"
        class="live-empty"
      >
        {{
          t(
            "No reporting categories are available for this site. Ask your administrator to configure them.",
          )
        }}
      </p>
      <template v-else>
        <LoadingStatus
          v-if="locationsLoading"
          :label="t('Loading buildings…')"
        />
        <p v-else-if="locationsError" class="live-error" role="alert">
          {{ t(locationsError) }}
          <button type="button" @click="loadLocations(data.selectedSiteId)">
            {{ t("Retry") }}
          </button>
        </p>
        <section v-else-if="!subsites.length" class="missing-building-empty">
          <p class="live-empty">{{ t('Reporting is not ready: a site admin must add a labelled building first.') }} <RouterLink v-if="canManageBuildings" :to="{ name:'subsites', params:{siteId:data.selectedSiteId} }">{{ t('Set up buildings →') }}</RouterLink></p>
          <button type="button" class="text-action" aria-controls="building-suggestion-fields" :aria-expanded="showSuggestion" @click="openSuggestion">{{ t('Suggest a missing building') }}</button>
          <p v-if="requestSent" role="status">{{ t('Your request was sent to the site administrator.') }}</p>
          <div v-if="showSuggestion && !requestSent" id="building-suggestion-fields" class="inline-location-suggestion">
            <label>{{ t('Suggested building or location') }}<input ref="suggestionInput" v-model="requestNote" maxlength="255" /></label>
            <p v-if="requestError" role="alert" class="live-error">{{ t(requestError) }}</p>
            <button type="button" class="report-issue-button" :disabled="requestBusy || !requestNote.trim()" @click="requestLocation">{{ t(requestBusy ? 'Sending…' : 'Suggest and select building') }}</button>
          </div>
        </section>
        <form v-else class="draft-form" @submit.prevent="submit">
          <p v-if="error" role="alert" class="live-error">{{ t(error) }}</p>
          <fieldset :disabled="submitting" class="report-fields">
            <div class="create-section">
              <div class="create-section-label">
                <h2>{{ t("Issue details") }}</h2>
              </div>
              <div class="create-section-fields">
                <label
                  >{{ t("What happened?")
                  }}<textarea
                    v-model="description"
                    required
                    maxlength="10000"
                    rows="5"
                    :placeholder="t('Describe the issue and what you noticed.')"
                  />
                </label>
              </div>
            </div>
            <div class="create-section">
              <div class="create-section-label">
                <h2>{{ t("Location") }}</h2>
              </div>
              <div class="create-section-fields">
                <div class="form-two-columns">
                  <div>
                    <label
                      >{{ t("Building or location")
                      }}<select v-model.number="subsiteId" required>
                        <option :value="null" disabled>
                          {{ t("Choose a building") }}
                        </option>
                        <option v-if="suggestedLocation" value="suggested">{{ suggestedLocation.name }} · {{ t('Suggested — pending review') }}</option>
                        <option
                          v-for="item in subsites"
                          :key="item.id"
                          :value="item.id"
                        >
                          {{ item.label }} · {{ item.name }}
                        </option>
                      </select></label
                    ><button
                      type="button"
                      class="text-action"
                      aria-controls="building-suggestion-fields"
                      :aria-expanded="showSuggestion"
                      @click="openSuggestion"
                    >
                      {{ t("Can’t find your building?") }}
                    </button>
                  </div>
                  <label
                    >{{ t("Room or exact spot (optional)")
                    }}<input
                      v-model="address"
                      maxlength="512"
                      :placeholder="t('Floor, room, or nearby landmark')"
                  /></label>
                </div>
                <div v-if="showSuggestion" id="building-suggestion-fields" class="inline-location-suggestion">
                  <label>{{ t('Suggested building or location') }}<input ref="suggestionInput" v-model="requestNote" maxlength="255" :placeholder="t('Building name or how to find it')" /></label>
                  <p v-if="requestError" class="live-error" role="alert">{{ t(requestError) }}</p>
                  <div class="suggestion-actions"><button type="button" class="report-issue-button" :disabled="requestBusy || !requestNote.trim() || requestSent" @click="requestLocation">{{ t(requestBusy ? 'Sending…' : 'Suggest and select building') }}</button><button type="button" class="text-action" :disabled="requestBusy" @click="showSuggestion = false">{{ t('Cancel') }}</button></div>
                </div>
                <p v-if="requestSent && suggestedLocation" class="field-hint" role="status">{{ t('Your suggested location is selected. The administrator will review it; the report records the location you entered.') }}</p>
              </div>
            </div>
            <div class="create-section">
              <div class="create-section-label">
                <h2>{{ t("Classification and visibility") }}</h2>
              </div>
              <div class="create-section-fields">
                <div class="form-two-columns">
                  <label
                    >{{ t("Category")
                    }}<select v-model="category" required>
                      <option disabled value="">
                        {{ t("Choose a category") }}
                      </option>
                      <option
                        v-for="item in categories"
                        :key="item"
                        :value="item"
                      >
                        {{ t(humanize(item)) }}
                      </option>
                    </select></label
                  >
                  <label
                    >{{ t("Your urgency")
                    }}<select v-model="urgency" required>
                      <option disabled value="">
                        {{ t("Choose an urgency") }}
                      </option>
                      <option
                        v-for="(label, value) in urgencyLabels"
                        :key="value"
                        :value="value"
                      >
                        {{ t(label) }}
                      </option>
                    </select></label
                  >
                </div>
                <label
                  >{{ t("Specialty (optional)")
                  }}<input
                    v-model="specialty"
                    maxlength="128"
                    :placeholder="t('Specific trade or equipment, if known')"
                /></label>
                <label
                  >{{ t("Report visibility")
                  }}<select v-model="visibility" required>
                    <option value="public">
                      {{ t("Public within your site") }}
                    </option>
                    <option value="private">{{ t("Private report") }}</option>
                  </select></label
                >
                <p class="field-hint">
                  {{
                    t(
                      visibility === "private"
                        ? "Private reports are restricted to the creator, attached reporters, authorized staff and admins, and the assigned technician."
                        : "Other reporters at your site can browse and join this report. Your identity and exact address stay masked until they join.",
                    )
                  }}
                </p>
                <label
                  >{{ t("Why this urgency? (optional)")
                  }}<textarea
                    v-model="reason"
                    rows="3"
                    maxlength="2000"
                    :placeholder="
                      t('Explain how this issue affects the space.')
                    "
                  />
                </label>
              </div>
            </div>
            <div class="create-section">
              <div class="create-section-label">
                <h2>{{ t("Attachments") }}</h2>
              </div>
              <div class="create-section-fields">
                <label
                  >{{ t("Photos (optional)")
                  }}<input
                    ref="photoInput"
                    type="file"
                    multiple
                    :accept="REPORT_PHOTO_TYPES.join(',')"
                    @change="selectPhotos"
                /></label>
                <p class="field-hint">
                  {{
                    t(
                      "Up to {limit} photos, 5 MiB each. Attached photos can be viewed by people authorized to access the report.",
                      { limit: REPORT_PHOTO_LIMIT },
                    )
                  }}
                </p>
                <p v-if="photoError" class="live-error" role="alert">
                  {{ t(photoError) }}
                  {{ t("Choose again or clear the selection to continue.") }}
                </p>
                <ul v-if="photos.length">
                  <li v-for="(photo, index) in photos" :key="index">
                    {{ photo.name }}
                  </li>
                </ul>
                <button
                  v-if="photos.length || photoError"
                  type="button"
                  class="text-action"
                  @click="clearPhotos"
                >
                  {{ t("Clear photo selection") }}
                </button>
              </div>
            </div>
            <div class="create-actions">
              <button
                class="report-issue-button"
                type="submit"
                :disabled="submitting || !!photoError"
              >
                {{ t(submitting ? "Submitting…" : "Submit report")
                }}<ArrowRight :size="18" />
              </button>
            </div>
          </fieldset>
        </form>

      </template>
    </div>
  </section>
</template>

<style scoped>
.report-create {
  max-width: 960px;
  display: grid;
  gap: 24px;
}
.create-header {
  padding: 8px 0 22px;
  border-bottom: 1px solid #e0e9e4;
}
.create-header h1 {
  margin: 16px 0 8px;
  font-size: 32px;
  line-height: 1.15;
  letter-spacing: -0.03em;
  font-weight: 700;
}
.create-header p {
  max-width: 680px;
}
.create-surface {
  background: white;
  border: 1px solid #e1e9e5;
  border-radius: 14px;
  padding: 28px;
}
.create-surface .report-fields {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0;
}
.create-section {
  display: grid;
  grid-template-columns: minmax(140px, 0.32fr) minmax(0, 1fr);
  gap: 28px;
  padding: 28px 0;
  border-bottom: 1px solid #e6eeea;
  align-items: start;
}
.create-section-fields {
  display: grid;
  gap: 16px;
  min-width: 0;
}
.create-section:first-child {
  padding-top: 0;
}
.create-section h2 {
  font-size: 18px;
  font-weight: 700;
}
.create-section label {
  display: grid;
  gap: 8px;
  min-width: 0;
  font-weight: 600;
}
.create-section input,
.create-section textarea,
.create-section select {
  width: 100%;
  min-width: 0;
  border: 1px solid #cbdad2;
  background: #fff;
  border-radius: 8px;
  padding: 11px 12px;
  font-weight: 400;
}
.create-section input[type="file"] {
  height: auto;
  min-height: 0;
}
.create-section .field-hint {
  margin: 0;
  line-height: 1.6;
}
.create-actions {
  padding-top: 24px;
}
.missing-location {
  border-top: 1px solid #e8eeea;
  margin-top: 26px;
  padding-top: 22px;
}
.missing-location h2 {
  font-size: 16px;
  font-weight: 650;
}
.missing-location p {
  font-size: 13px;
  color: #52677b;
  margin: 8px 0;
}
.missing-location form {
  margin-top: 12px;
}
.missing-location .text-action {
  width: max-content;
}
.report-create .live-empty a {
  color: #006f65;
  text-decoration: underline;
}
@media (max-width: 700px) {
  .create-section {
    grid-template-columns: 1fr;
    gap: 14px;
  }
  .create-surface {
    padding: 18px;
  }
  .create-section .form-two-columns {
    grid-template-columns: 1fr;
  }
}
/* Keep controls aligned across Safari and Chromium, independent of native defaults. */
.report-create{max-width:none;width:100%;gap:18px;padding-top:0!important}
.create-header{padding:0 0 18px}
.create-header h1{margin:12px 0 8px;font-size:30px}
.create-header p{max-width:none;margin:0;line-height:1.6}
.create-header>a{display:inline-flex;align-items:center;min-height:28px}
.create-section .form-two-columns{align-items:start;gap:18px}
.create-section .form-two-columns>div{display:grid;gap:8px;align-content:start}
.create-section label{display:flex;flex-direction:column;justify-content:flex-start;gap:8px;align-self:start;line-height:20px}
.create-section input:not([type=file]),.create-section select{height:44px;min-height:44px;box-sizing:border-box;font-size:14px;line-height:20px;margin:0}
.create-section select{appearance:none;-webkit-appearance:none;padding-right:32px;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2352677b' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center}
.create-section textarea{font-size:14px;line-height:1.6;min-height:100px;box-sizing:border-box;margin:0}
.create-section{padding:22px 0;grid-template-columns:180px minmax(0,1fr);gap:28px}
.create-section .text-action{justify-self:start;margin:0;min-height:24px}
@media(max-width:800px){.create-section{grid-template-columns:1fr;gap:14px}.create-header h1{font-size:26px}}
.inline-location-suggestion{display:grid;gap:12px;padding:16px;border:1px solid #dfe7e2;border-radius:8px;background:#f6faf8}.suggestion-actions{display:flex;flex-wrap:wrap;gap:12px;align-items:center}.suggestion-actions .report-issue-button{font-size:13px;min-height:40px;padding:10px 14px}
</style>
