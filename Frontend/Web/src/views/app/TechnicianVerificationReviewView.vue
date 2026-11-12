<script setup lang="ts">
import { onMounted, ref } from "vue";
import LoadingStatus from "@/components/ui/LoadingStatus.vue";
import { useLocale } from "@/i18n";
import { errorMessage, request } from "@/services/api";
import {
  listVerifications,
  decideVerification,
  type TechnicianVerification,
} from "@/services/technicianVerification";
const { t } = useLocale();
const items = ref<TechnicianVerification[]>([]);
const error = ref("");
const busy = ref(false);
const loading = ref(false);
const selected = ref<TechnicianVerification>();
const reason = ref("");
const identityChecked = ref(false),
  emailChecked = ref(false),
  phoneChecked = ref(false),
  tradeChecked = ref(false);
const terms = ref<{
  currentVersion: string | null;
  documentUrl: string | null;
  enforcementRequired: boolean;
  acceptedCurrentVersion: boolean;
} | null>(null);
const history = ref<
  { id: number; status: string; actorId: number; createdAt: string }[]
>([]);
async function load() {
  if (loading.value) return;
  loading.value = true;
  error.value = "";
  try {
    items.value = await listVerifications();
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}
async function review(item: TechnicianVerification) {
  selected.value = item;
  reason.value = "";
  identityChecked.value = item.identityChecked;
  emailChecked.value = item.emailChecked;
  phoneChecked.value = item.phoneChecked;
  tradeChecked.value = item.tradeChecked;
  history.value = [];
  terms.value = null;
  try {
    terms.value = await request(`/api/technician-terms/${item.technicianId}`);
    history.value = await request(
      `/api/admin/technician-verifications/${item.technicianId}/history`,
    );
  } catch (e) {
    error.value = errorMessage(e);
  }
}
async function decide(status: string) {
  if (!selected.value) return;
  busy.value = true;
  error.value = "";
  try {
    await decideVerification(selected.value.technicianId, {
      status,
      reason: reason.value,
      version: selected.value.version,
      identityChecked: identityChecked.value,
      emailChecked: emailChecked.value,
      phoneChecked: phoneChecked.value,
      tradeChecked: tradeChecked.value,
    });
    selected.value = undefined;
    await load();
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
onMounted(load);
</script>
<template>
  <section class="verification-page live-page">
    <header class="verification-header">
      <div>
        <span class="verification-eyebrow">{{ t("PLATFORM OPERATIONS") }}</span>
        <h1>{{ t("Technician verification") }}</h1>
        <p>
          {{
            t(
              "Reviewers must perform and record real manual checks. Contact checks are not automated email or SMS verification.",
            )
          }}
        </p>
      </div>
      <button class="text-action" type="button" :disabled="busy || loading" @click="load">
        {{ t("Refresh applications") }} ↻
      </button>
    </header>
    <p v-if="error" role="alert" class="live-error">{{ error }} <button type="button" :disabled="busy || loading" @click="load">{{ t("Retry") }}</button></p>
    <LoadingStatus v-if="loading" :label="t('Loading verification applications…')" />
    <div class="verification-layout">
      <section class="dashboard-card verification-queue">
        <div class="verification-section-title">
          <div>
            <h2>{{ t("Applications") }}</h2>
            <p v-if="!loading && !error">{{ t("{count} applications", { count: items.length }) }}</p>
          </div>
        </div>
        <p v-if="!loading && !error && !items.length" class="live-empty">
          {{ t("No applications to review.") }}
        </p>
        <ul v-else class="verification-applications">
          <li v-for="item in items" :key="item.technicianId">
            <button
              type="button"
              :disabled="busy || loading"
              :aria-current="
                selected?.technicianId === item.technicianId
                  ? 'true'
                  : undefined
              "
              @click="review(item)"
            >
              <span class="verification-person">#{{ item.technicianId }}</span
              ><span class="verification-applicant"
                ><strong>{{ item.email }}</strong
                ><small>{{ t(item.status) }}</small></span
              ><span aria-hidden="true">→</span>
            </button>
          </li>
        </ul>
      </section>
      <section v-if="selected" class="dashboard-card verification-review">
        <div class="verification-section-title">
          <div>
            <span class="verification-eyebrow">{{
              t("APPLICATION REVIEW")
            }}</span>
            <h2>{{ t("Manual review") }} · #{{ selected.technicianId }}</h2>
          </div>
          <span class="status-badge mint">{{ t(selected.status) }}</span>
        </div>
        <dl class="verification-details">
          <div>
            <dt>{{ t("Contact email") }}</dt>
            <dd>{{ selected.email }}</dd>
          </div>
          <div>
            <dt>{{ t("Contact phone") }}</dt>
            <dd>{{ selected.phone }}</dd>
          </div>
          <div>
            <dt>{{ t("Trades") }}</dt>
            <dd>{{ selected.trades }}</dd>
          </div>
          <div>
            <dt>{{ t("Experience") }}</dt>
            <dd>{{ selected.experience }}</dd>
          </div>
          <div>
            <dt>{{ t("Qualifications and references") }}</dt>
            <dd>{{ selected.qualifications }}</dd>
          </div>
        </dl>
        <section class="verification-terms">
          <h3>{{ t("Professional terms") }}</h3>
          <p>
            {{ t("Professional terms are separate from a site contract.") }}
          </p>
          <p v-if="terms">
            {{ terms.currentVersion || t("Not configured") }} ·
            {{ t(terms.acceptedCurrentVersion ? "Accepted" : "Not accepted") }}
            · {{ t("Required") }}
            <a
              v-if="terms.documentUrl"
              :href="terms.documentUrl"
              target="_blank"
              rel="noopener noreferrer"
              >{{ t("View terms") }}</a
            >
          </p>
          <p v-else>{{ t("Professional terms status unavailable.") }}</p>
        </section>
        <form class="verification-checks" @submit.prevent="decide('verified')">
          <fieldset :disabled="busy || loading">
            <legend>{{ t("Manual checks") }}</legend>
            <p>
              {{
                t(
                  "Confirm each check only after performing it. All four are required for approval.",
                )
              }}
            </p>
            <label
              ><input v-model="identityChecked" type="checkbox" />{{
                t("Identity manually checked")
              }}</label
            ><label
              ><input v-model="emailChecked" type="checkbox" />{{
                t("Contact email manually checked")
              }}</label
            ><label
              ><input v-model="phoneChecked" type="checkbox" />{{
                t("Contact phone manually checked")
              }}</label
            ><label
              ><input v-model="tradeChecked" type="checkbox" />{{
                t("Trade qualifications manually checked")
              }}</label
            ><label
              >{{ t("Decision reason")
              }}<textarea v-model="reason" required maxlength="2000" />
            </label>
            <div class="verification-actions">
              <template v-if="selected.status === 'pending'"
                ><button
                  class="report-issue-button"
                  type="submit"
                  :disabled="
                    !reason.trim() ||
                    !identityChecked ||
                    !emailChecked ||
                    !phoneChecked ||
                    !tradeChecked ||
                    !terms ||
                    !terms.currentVersion ||
                    !terms.documentUrl ||
                    !terms.acceptedCurrentVersion
                  "
                >
                  {{ t("Approve verification") }}</button
                ><button
                  class="text-action"
                  type="button"
                  :disabled="!reason.trim()"
                  @click="decide('rejected')"
                >
                  {{ t("Reject") }}
                </button></template
              ><button
                v-if="selected.status === 'verified'"
                class="text-action"
                type="button"
                :disabled="!reason.trim()"
                @click="decide('suspended')"
              >
                {{ t("Suspend") }}</button
              ><button
                v-if="['rejected', 'suspended'].includes(selected.status)"
                class="text-action"
                type="button"
                :disabled="!reason.trim()"
                @click="decide('pending')"
              >
                {{ t("Return to review") }}
              </button>
            </div>
          </fieldset>
        </form>
        <section class="verification-history">
          <h3>{{ t("Decision history") }}</h3>
          <p v-if="!history.length">{{ t("No decisions recorded.") }}</p>
          <ul v-else>
            <li v-for="entry in history" :key="entry.id">
              {{ entry.createdAt }} · {{ t(entry.status) }} · #{{
                entry.actorId
              }}
            </li>
          </ul>
        </section>
      </section>
      <section v-else class="dashboard-card verification-placeholder">
        <h2>{{ t("Choose an application") }}</h2>
        <p>
          {{
            t(
              "Review an applicant to inspect their details, manual checks, terms status and decision history.",
            )
          }}
        </p>
      </section>
    </div>
  </section>
</template>

<style scoped>
.verification-page {
  display: grid;
  gap: 18px;
}
.verification-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 22px 26px;
  border: 1px solid #dfe9e2;
  border-radius: 18px;
  background: linear-gradient(110deg, #eef7f0, #fff);
}
.verification-eyebrow {
  color: #006f65;
  font-size: 10px;
  letter-spacing: 0.14em;
  font-weight: 750;
}
.verification-header h1 {
  margin: 6px 0;
  color: #152742;
  font-size: clamp(25px, 3vw, 34px);
}
.verification-header p,
.verification-section-title p {
  margin: 0;
  color: #52677b;
  line-height: 1.6;
}
.verification-layout {
  display: grid;
  grid-template-columns: minmax(240px, 0.75fr) minmax(0, 1.5fr);
  gap: 16px;
  align-items: start;
}
.verification-queue,
.verification-review,
.verification-placeholder {
  padding: 22px;
}
.verification-section-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.verification-section-title h2 {
  margin: 4px 0;
  color: #152742;
  font-size: 19px;
}
.verification-applications {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.verification-applications button {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px;
  border: 1px solid #e5ece7;
  border-radius: 12px;
  background: #fff;
  color: #152742;
  text-align: left;
  cursor: pointer;
}
.verification-applications button[aria-current="true"] {
  border-color: #63cdb8;
  background: #effaf6;
}
.verification-person {
  color: #006f65;
  font-weight: 750;
}
.verification-applicant {
  display: grid;
  gap: 3px;
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
.verification-applicant small {
  color: #718276;
}
.verification-details {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin: 0;
}
.verification-details div {
  min-width: 0;
  padding: 14px;
  border-radius: 12px;
  background: #f6f9f6;
}
.verification-details div:last-child {
  grid-column: 1/-1;
}
.verification-details dt {
  font-weight: 700;
  color: #52677b;
  font-size: 12px;
}
.verification-details dd {
  margin: 5px 0 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.verification-terms,
.verification-history {
  margin-top: 18px;
  padding: 16px;
  border: 1px solid #e4ebe6;
  border-radius: 12px;
}
.verification-terms h3,
.verification-history h3 {
  margin: 0 0 8px;
  color: #152742;
}
.verification-terms p,
.verification-history p {
  margin: 6px 0;
  color: #52677b;
}
.verification-checks {
  margin-top: 18px;
}
.verification-checks fieldset {
  display: grid;
  gap: 12px;
  padding: 18px;
  border: 1px solid #dfe9e2;
  border-radius: 12px;
}
.verification-checks legend {
  padding: 0 8px;
  font-weight: 700;
  color: #152742;
}
.verification-checks label {
  display: flex;
  align-items: flex-start;
  gap: 9px;
}
.verification-checks input[type="checkbox"] {
  margin-top: 3px;
}
.verification-checks textarea {
  display: block;
  width: 100%;
  min-height: 100px;
  margin-top: 6px;
}
.verification-actions {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
}
.verification-history ul {
  padding-left: 20px;
}
.verification-placeholder {
  min-height: 260px;
  display: grid;
  align-content: center;
  text-align: center;
  color: #52677b;
}
@media (max-width: 800px) {
  .verification-layout {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 600px) {
  .verification-header {
    align-items: flex-start;
    flex-direction: column;
  }
  .verification-details {
    grid-template-columns: 1fr;
  }
  .verification-details div:last-child {
    grid-column: auto;
  }
}
</style>
