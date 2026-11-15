<script setup lang="ts">
import LoadingStatus from "@/components/ui/LoadingStatus.vue";
import { useLocale } from "@/i18n";
import TechnicianTermsPanel from "@/components/TechnicianTermsPanel.vue";
import TechnicianAvailabilityPanel from "@/components/technician/TechnicianAvailabilityPanel.vue";
import TechnicianVerificationPanel from "@/components/technician/TechnicianVerificationPanel.vue";
import TechnicianJobOffersPanel from "@/components/technician/TechnicianJobOffersPanel.vue";
import { onMounted, ref } from "vue";
import { Handshake, UserRound, ArrowRight } from "@lucide/vue";
import { useAuth } from "@/composables/useAuth";
import { listMyAssignedReports } from "@/services/maintenance";
import { errorMessage } from "@/services/api";
import type { Report } from "@/types/maintenance";
import { formatDate, humanize } from "@/utils/maintenance";

const { t } = useLocale();
const { user } = useAuth();
const assigned = ref<Report[] | null>(null);
const assignedError = ref("");
const loadingAssigned = ref(false);

async function loadAssigned() {
  loadingAssigned.value = true;
  assignedError.value = "";
  try {
    assigned.value = await listMyAssignedReports();
  } catch (err) {
    assigned.value = [];
    assignedError.value = errorMessage(err);
  } finally {
    loadingAssigned.value = false;
  }
}

onMounted(() => {
  void loadAssigned();
});
</script>
<template>
  <div class="tech-page">
    <header class="tech-header">
      <div>
        <p class="tech-eyebrow">{{ t("Technician workspace") }}</p>
        <h1>
          {{
            user?.firstName
              ? t("Your technician workspace, {name}", { name: user.firstName })
              : t("Your technician workspace")
          }}
        </h1>
        <p>
          {{ t("Manage your availability, eligibility and assigned work.") }}
        </p>
      </div>
      <RouterLink to="/profile" class="action-link"
        >{{ t("Manage trade details") }} →</RouterLink
      >
    </header>
    <div class="tech-work-grid">
      <section class="dashboard-card tech-work-card">
        <div class="tech-card-heading">
          <h2>{{ t("Assigned work") }}</h2>
          <button
            type="button"
            class="text-action"
            :disabled="loadingAssigned"
            @click="loadAssigned"
          >
            {{ t("Refresh") }}
          </button>
        </div>
        <LoadingStatus
          v-if="loadingAssigned && assigned == null"
          :label="t('Loading available work…')"
        />
        <p v-else-if="assignedError" class="live-error" role="alert">
          {{ t(assignedError) }}
          <button type="button" class="text-action" @click="loadAssigned">
            {{ t("Retry") }}
          </button>
        </p>
        <template v-else-if="assigned">
          <p>
            {{
              t("{count} reports are assigned to you.", {
                count: assigned.length,
              })
            }}
          </p>
          <ul v-if="assigned.length" class="assigned-list">
            <li v-for="report in assigned" :key="report.id">
              <RouterLink class="text-action" :to="`/reports/${report.id}`">
                {{ t("Report #{id}", { id: report.id }) }}
              </RouterLink>
              <span
                >{{ t(humanize(report.status)) }} ·
                {{ t(humanize(report.category)) }} ·
                {{ formatDate(report.updatedAt, true) }}</span
              >
            </li>
          </ul>
          <p v-else>
            {{
              t(
                "No assigned reports yet. Accept a paid offer below, or open a marketplace job that was awarded to you.",
              )
            }}
          </p>
        </template>
        <RouterLink
          v-if="assigned?.length"
          to="/reports"
          class="text-action"
          >{{ t("View assigned reports →") }}</RouterLink
        >
      </section>
      <section class="dashboard-card tech-work-card">
        <h2>{{ t("Job marketplace") }}</h2>
        <p>
          {{
            t(
              "Browse jobs, check your applications and open reports for accepted offers.",
            )
          }}
        </p>
        <RouterLink to="/marketplace" class="text-action"
          >{{ t("Open job marketplace") }} <ArrowRight :size="15"
        /></RouterLink>
      </section>
    </div>
    <TechnicianJobOffersPanel @changed="loadAssigned" />
    <section class="tech-section" aria-labelledby="eligibility-title">
      <div class="tech-section-heading">
        <h2 id="eligibility-title">{{ t("Eligibility and availability") }}</h2>
      </div>
      <div class="tech-status-grid">
        <TechnicianVerificationPanel /><TechnicianTermsPanel /><TechnicianAvailabilityPanel />
      </div>
    </section>
    <section class="tech-section" aria-labelledby="sites-title">
      <div class="tech-section-heading">
        <h2 id="sites-title">{{ t("Sites and contracts") }}</h2>
        <RouterLink to="/technician/marketplace" class="text-action"
          >{{ t("Find sites hiring") }} →</RouterLink
        >
      </div>
      <div class="tech-site-grid">
        <article class="dashboard-card">
          <span class="stat-icon mint"><UserRound :size="24" /></span>
          <h3>{{ t("Independent by default") }}</h3>
          <p>
            {{
              t(
                "New technician accounts start without a site or any site contracts. A contract is optional; you can keep your account without signing one.",
              )
            }}
          </p>
          <RouterLink to="/profile" class="text-action"
            >{{ t("View your account") }} <ArrowRight :size="15"
          /></RouterLink>
        </article>
        <article class="dashboard-card">
          <span class="stat-icon citron"><Handshake :size="24" /></span>
          <h3>{{ t("Work with a site") }}</h3>
          <p>
            {{
              t(
                "A site contract is a separate agreement approved by a site administrator. It is never created automatically during registration.",
              )
            }}
          </p>
          <RouterLink to="/contracts" class="text-action"
            >{{ t("Site contract options") }} <ArrowRight :size="15"
          /></RouterLink>
        </article>
      </div>
    </section>
  </div>
</template>
<style scoped>
.tech-page {
  display: grid;
  gap: 24px;
  min-width: 0;
}
.tech-header {
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: 20px;
  border-bottom: 1px solid #e0e9e4;
  padding: 10px 0 24px;
}
.tech-header h1 {
  font-size: 32px;
  font-weight: 700;
  letter-spacing: -0.03em;
}
.tech-header p {
  color: #52677b;
  margin-top: 6px;
}
.tech-eyebrow {
  color: #006f65 !important;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
  font-size: 12px;
}
.tech-work-grid,
.tech-site-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
.tech-work-card,
.tech-site-grid article {
  padding: 22px;
}
.tech-card-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.tech-work-card h2,
.tech-site-grid h3 {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
}
.tech-work-card p,
.tech-site-grid p {
  color: #52677b;
  line-height: 1.6;
  margin: 10px 0 18px;
}
.assigned-list {
  list-style: none;
  margin: 0 0 16px;
  padding: 0;
  display: grid;
  gap: 10px;
}
.assigned-list li {
  display: grid;
  gap: 4px;
}
.assigned-list span {
  color: #62778a;
  font-size: 13px;
}
.tech-site-grid h3 {
  margin-top: 14px;
}
.tech-section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}
.tech-section-heading h2 {
  font-size: 19px;
  font-weight: 700;
}
.tech-status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
  gap: 16px;
  align-items: start;
}
.tech-status-grid > * {
  min-width: 0;
  margin: 0;
}
@media (max-width: 700px) {
  .tech-header {
    align-items: start;
    flex-direction: column;
  }
  .tech-work-grid,
  .tech-site-grid {
    grid-template-columns: 1fr;
  }
  .tech-section-heading {
    align-items: start;
    flex-direction: column;
  }
}
</style>
