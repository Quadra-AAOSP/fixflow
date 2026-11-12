<script setup lang="ts">
import LoadingStatus from "@/components/ui/LoadingStatus.vue";
import { useLocale } from "@/i18n";
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import MySiteVetting from "@/components/technician/MySiteVetting.vue";
import ContractDirectoryPanel from "@/components/technician/ContractDirectoryPanel.vue";
import ContractApplicationsPanel from "@/components/technician/ContractApplicationsPanel.vue";
import { Handshake, ShieldCheck } from "@lucide/vue";
import { useAuth } from "@/composables/useAuth";
import { useMaintenanceStore } from "@/stores/maintenance";
import {
  createTechnicianContract,
  type TechnicianContract,
} from "@/services/access";
import { errorMessage } from "@/services/api";
import { formatDate } from "@/utils/maintenance";
const { t } = useLocale();
const { user } = useAuth();
const route = useRoute();
const initialSiteId = computed(() => {
  const id = Number(route.query.siteId);
  return Number.isSafeInteger(id) && id > 0 ? id : undefined;
});
const data = useMaintenanceStore();
const isManager = computed(
  () => user.value?.role === "admin" || user.value?.role === "super_admin",
);
const siteId = ref("");
const technicianId = ref("");
const consent = ref(false);
const busy = ref(false);
const error = ref("");
const created = ref<TechnicianContract | null>(null);
const contractRevision = ref(0);
watch(
  () => data.selectedSiteId,
  (id) => {
    if (!busy.value) siteId.value = id == null ? "" : String(id);
  },
  { immediate: true },
);
async function submit() {
  if (busy.value) return;
  error.value = "";
  created.value = null;
  const technician = Number(technicianId.value);
  const site = Number(siteId.value);
  if (
    !isManager.value ||
    !Number.isSafeInteger(technician) ||
    technician <= 0 ||
    !data.sites.some((item) => item.id === site) ||
    !consent.value
  ) {
    error.value =
      "Choose an accessible site, enter a valid technician ID, and confirm their agreement.";
    return;
  }
  busy.value = true;
  try {
    created.value = await createTechnicianContract(technician, site);
    contractRevision.value++;
    technicianId.value = "";
    consent.value = false;
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <section class="contracts-page live-page">
    <header class="operation-header">
      <div>
        <span class="contracts-eyebrow">{{ t("WORKING TOGETHER") }}</span>
        <h1>{{ t("Site contracts") }}</h1>
        <p>{{ t("Optional site relationships for technicians") }}</p>
      </div>
      <span class="contracts-mark"><Handshake :size="24" /></span>
    </header>
    <section
      v-if="user?.role === 'technician'"
      class="dashboard-card contract-choice"
    >
      <div class="contract-choice-copy">
        <span class="contracts-eyebrow">{{ t("YOUR CHOICE") }}</span>
        <h2>{{ t("Stay independent") }}</h2>
        <p>
          {{
            t(
              "No site contract is required to keep your account. You can continue independently or request a site contract below.",
            )
          }}
        </p>
        <RouterLink to="/technician" class="text-action"
          >{{ t("Continue independently") }} →</RouterLink
        >
      </div>
      <span class="contract-choice-number">01</span>
    </section>
    <section v-else-if="isManager" class="dashboard-card contract-create-panel">
      <div class="contract-panel-heading">
        <div>
          <span class="contracts-eyebrow">{{ t("ADMINISTRATION") }}</span>
          <h2>{{ t("Record an agreed contract") }}</h2>
          <p>
            {{
              t(
                "Record a site contract only after the technician has agreed. This creates a direct contract entry and does not process an online request or record approval history.",
              )
            }}
          </p>
        </div>
        <ShieldCheck :size="26" />
      </div>
      <div v-if="created" role="status" class="draft-notice">
        {{
          t(
            "Contract #{id} created for technician #{technicianId} at {site} on {date}.",
            {
              id: created.id,
              technicianId: created.technicianId,
              site: data.siteName(created.siteId),
              date: formatDate(created.createdAt, true),
            },
          )
        }}
      </div>
      <LoadingStatus v-if="data.loading" :label="t('Loading sites…')" />
      <p v-else-if="!data.sites.length" class="live-empty">
        {{ t("An accessible site is required to record a contract.") }}
      </p>
      <form
        v-else
        class="draft-form contract-create-form"
        @submit.prevent="submit"
      >
        <p v-if="error" role="alert" class="live-error">{{ t(error) }}</p>
        <fieldset class="report-fields" :disabled="busy">
          <label
            >{{ t("Site")
            }}<select v-model="siteId" required>
              <option disabled value="">{{ t("Choose a site") }}</option>
              <option
                v-for="site in data.sites"
                :key="site.id"
                :value="String(site.id)"
              >
                {{ site.name }}
              </option>
            </select></label
          ><label
            >{{ t("Technician account ID")
            }}<input
              v-model="technicianId"
              type="number"
              min="1"
              step="1"
              required /></label
          ><label class="consent-row"
            ><input v-model="consent" type="checkbox" required /><span>{{
              t("The technician has agreed to this site contract.")
            }}</span></label
          ><button class="report-issue-button" :disabled="busy" type="submit">
            <ShieldCheck :size="18" />{{
              t(busy ? "Saving…" : "Record agreed contract")
            }}
          </button>
        </fieldset>
      </form>
      <p class="contract-note">
        {{
          t(
            "The request history below is separate from direct contract creation.",
          )
        }}
      </p>
    </section>
    <section class="contract-workspace">
      <MySiteVetting
        v-if="user?.role === 'technician'"
      /><ContractDirectoryPanel
        :revision="contractRevision"
      /><ContractApplicationsPanel
        :initial-site-id="initialSiteId"
        @contract-created="contractRevision++"
      />
    </section>
  </section>
</template>

<style scoped>
.contracts-page {
  display: grid;
  gap: 20px;
}
.contracts-eyebrow {
  color: #006f65;
  font-size: 10px;
  letter-spacing: 0.14em;
  font-weight: 750;
}
.contracts-page .operation-header h1 {
  margin: 6px 0;
  color: #152742;
}
.contracts-page .operation-header p {
  margin: 0;
  color: #52677b;
}
.contracts-mark {
  display: grid;
  place-items: center;
  width: 54px;
  height: 54px;
  border-radius: 18px;
  background: #d9f5ed;
  color: #006f65;
}
.contract-choice,
.contract-create-panel {
  padding: 26px;
}
.contract-choice {
  display: flex;
  justify-content: space-between;
  gap: 22px;
  background: linear-gradient(115deg, #edf7ef, #fff);
}
.contract-choice h2,
.contract-panel-heading h2 {
  margin: 7px 0;
  color: #152742;
  font-size: 22px;
}
.contract-choice p,
.contract-panel-heading p,
.contract-note {
  max-width: 760px;
  color: #52677b;
  line-height: 1.65;
}
.contract-choice-number {
  color: #bfdbcc;
  font-size: 68px;
  font-weight: 750;
}
.contract-panel-heading {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  color: #006f65;
}
.contract-create-form {
  max-width: 650px;
  margin-top: 20px;
}
.contract-note {
  margin: 18px 0 0;
  font-size: 13px;
}
.contract-workspace {
  display: grid;
  gap: 18px;
}
</style>
