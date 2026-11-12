<script setup lang="ts">
import { onMounted, ref } from "vue";
import LoadingStatus from "@/components/ui/LoadingStatus.vue";
import { request, errorMessage } from "@/services/api";
type Application = {
  id: number;
  organization: string;
  siteName: string;
  siteType: string;
  address: string;
  contactEmail: string;
  contactPhone: string;
  relationship: string;
  adminFirstName: string;
  adminLastName: string;
  adminEmail: string;
  adminPhone: string;
  status: string;
  message: string | null;
  siteId: number | null;
};
const applications = ref<Application[]>([]);
const reason = ref("");
const error = ref("");
const busy = ref(false);
const loading = ref(false);
const invitation = ref("");
async function load() {
  if (loading.value) return;
  loading.value = true;
  error.value = "";
  try {
    applications.value = await request("/api/admin/site-applications");
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}
async function decide(id: number, decision: string) {
  busy.value = true;
  error.value = "";
  try {
    await request(`/api/admin/site-applications/${id}/decision`, {
      method: "POST",
      body: JSON.stringify({ decision, reason: reason.value }),
    });
    reason.value = "";
    await load();
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
async function setup(id: number) {
  busy.value = true;
  error.value = "";
  invitation.value = "";
  try {
    const result = await request<{ setupToken: string; expiresAt: string }>(
      `/api/admin/site-applications/${id}/setup-invitation`,
      { method: "POST" },
    );
    invitation.value = `Setup token: ${result.setupToken}\nExpires: ${result.expiresAt}\nDeliver privately to the proposed site administrator for /setup-site-admin. No email has been sent. Issuing again invalidates earlier tokens.`;
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
onMounted(load);
</script>
<template>
  <section class="site-applications live-page">
    <header>
      <h1>Site applications</h1>
      <p>
        Review organization authority and the proposed administrator before
        approval. The applicant and proposed administrator may be different
        people.
      </p>
    </header>
    <p v-if="error" role="alert" class="live-error">{{ error }} <button type="button" :disabled="busy || loading" @click="load">Retry</button></p>
    <LoadingStatus v-if="loading" label="Loading site applications…" />
    <pre v-if="invitation" role="status">{{ invitation }}</pre>
    <div class="application-review-layout">
      <aside class="decision-context">
        <label
          >Decision reason or requested information<textarea
            v-model="reason"
            maxlength="2000"
            rows="6"
          />
        </label>
      </aside>
      <div class="application-queue">
        <article
          v-for="item in applications"
          :key="item.id"
          class="application-card"
        >
          <header class="application-heading">
            <h2>{{ item.siteName }}</h2>
            <span class="status-badge">{{ item.status }}</span>
          </header>
          <dl class="application-facts">
            <div>
              <dt>Organization</dt>
              <dd>{{ item.organization }} · {{ item.siteType }}</dd>
            </div>
            <div>
              <dt>Address</dt>
              <dd>{{ item.address }}</dd>
            </div>
            <div>
              <dt>Applicant</dt>
              <dd>
                {{ item.contactEmail }}<br />{{ item.contactPhone }} ·
                {{ item.relationship }}
              </dd>
            </div>
            <div>
              <dt>Proposed administrator</dt>
              <dd>
                {{ item.adminFirstName }} {{ item.adminLastName }}<br />{{
                  item.adminEmail
                }}
                · {{ item.adminPhone }}
              </dd>
            </div>
          </dl>
          <p v-if="item.message">{{ item.message }}</p>
          <footer class="application-actions">
            <template v-if="item.status === 'pending'">
              <button
                type="button"
                class="report-issue-button"
                :disabled="busy || loading || !reason.trim()"
                @click="decide(item.id, 'approve')"
              >
                Approve site #{{ item.id }}
              </button>
              <button
                type="button"
                class="action-link"
                :disabled="busy || loading || !reason.trim()"
                @click="decide(item.id, 'request_information')"
              >
                Request information #{{ item.id }}
              </button>
              <button
                type="button"
                class="action-link"
                :disabled="busy || loading || !reason.trim()"
                @click="decide(item.id, 'reject')"
              >
                Reject site #{{ item.id }}
              </button>
            </template>
            <button
              v-if="item.status === 'approved'"
              type="button"
              class="action-link"
              :disabled="busy || loading"
              @click="setup(item.id)"
            >
              Issue administrator setup token #{{ item.id }}
            </button>
          </footer>
        </article>
        <p v-if="!loading && !error && !applications.length" class="live-empty">
          No site applications.
        </p>
      </div>
    </div>
  </section>
</template>
<style scoped>
.site-applications {
  display: grid;
  gap: 24px;
}
h1 {
  font-size: 30px;
  font-weight: 750;
  letter-spacing: -0.035em;
}
.site-applications > header p {
  max-width: 760px;
  color: #52677b;
  margin-top: 12px;
}
p,
dd {
  font-size: 14px;
  line-height: 1.7;
  overflow-wrap: anywhere;
}
.application-review-layout {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}
.decision-context {
  position: sticky;
  top: 24px;
  border: 1px solid #dce5e4;
  padding: 22px;
  background: white;
  border-radius: 14px;
}
label {
  display: grid;
  gap: 12px;
  font-size: 14px;
  font-weight: 650;
}
textarea {
  min-width: 0;
  width: 100%;
  padding: 12px;
  border: 1px solid #aebfbc;
  border-radius: 8px;
  font-weight: 400;
  resize: vertical;
}
.application-queue {
  display: grid;
  gap: 20px;
  min-width: 0;
}
.application-card {
  border: 1px solid #dce5e4;
  background: white;
  border-radius: 14px;
  padding: 26px;
}
.application-heading {
  display: flex;
  justify-content: space-between;
  align-items: start;
  gap: 16px;
}
h2 {
  font-size: 20px;
  font-weight: 700;
}
.application-facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 22px;
  margin: 24px 0;
}
dt {
  color: #52677b;
  font-size: 12px;
  margin-bottom: 6px;
}
.application-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  border-top: 1px solid #e5ece9;
  padding-top: 20px;
  margin-top: 20px;
}
pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  border: 1px solid #b9cdc7;
  padding: 20px;
  background: #f1f6f4;
  border-radius: 10px;
}
@media (max-width: 950px) {
  .application-review-layout {
    grid-template-columns: 1fr;
  }
  .decision-context {
    position: static;
  }
}
@media (max-width: 550px) {
  .application-facts {
    grid-template-columns: 1fr;
  }
  .application-card {
    padding: 20px;
  }
}
</style>
