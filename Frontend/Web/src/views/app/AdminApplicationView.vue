<script setup lang="ts">
import LoadingStatus from "@/components/ui/LoadingStatus.vue";
import { useLocale } from "@/i18n";
import { formatDate, humanize } from "@/utils/maintenance";
import { onMounted, ref } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { useAuth } from "@/composables/useAuth";
import { getSiteAdminApplication } from "@/services/auth";
import { errorMessage } from "@/services/api";
import type { SiteAdminApplication } from "@/types";
const { t } = useLocale();
defineProps<{ applicationOnly?: boolean }>();
const router = useRouter();
const { logout } = useAuth();

const application = ref<SiteAdminApplication | null>(null);
const loading = ref(true);
const error = ref("");
const signOutError = ref("");
const signingOut = ref(false);

async function refresh() {
  loading.value = true;
  error.value = "";
  try {
    application.value = await getSiteAdminApplication();
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    loading.value = false;
  }
}

onMounted(refresh);
async function signOut() {
  signingOut.value = true;
  signOutError.value = "";
  try {
    await logout();
    await router.replace("/login");
  } catch (err) {
    signOutError.value = errorMessage(err);
  } finally {
    signingOut.value = false;
  }
}
</script>

<template>
  <component
    :is="applicationOnly ? 'main' : 'section'"
    class="page-content admin-application-page"
    :id="applicationOnly ? 'main-content' : undefined"
    :tabindex="applicationOnly ? -1 : undefined"
    :class="{ 'mx-auto px-5 py-10': applicationOnly }"
  >
    <header class="application-heading">
      <span class="form-kicker">{{ t("SITE ADMINISTRATOR") }}</span>
      <h1>{{ t("Your application") }}</h1>
      <p>
        {{
          t(
            "A super administrator reviews requests for site management access.",
          )
        }}
      </p>
    </header>
    <LoadingStatus v-if="loading" :label="t('Checking your application…')" />
    <p v-else-if="error" role="alert">{{ t(error) }}</p>
    <section v-else-if="application" class="managed-access-message">
      <h2>
        {{ t("Status: {status}", { status: t(humanize(application.status)) }) }}
      </h2>
      <p>{{ t("Site ID: {id}", { id: application.siteId }) }}</p>
      <p v-if="application.status === 'pending'">
        {{
          t(
            "You can check your application status while you wait for approval.",
          )
        }}
      </p>
      <p v-else-if="application.status === 'approved'">
        {{
          t(
            "Your request was approved. Sign out and sign in again to refresh your site-admin access.",
          )
        }}
      </p>
      <p v-else>
        {{
          t(
            "Your request was not approved. Contact the platform owner if you need details or would like to discuss access.",
          )
        }}
      </p>
      <p>
        {{
          t("Submitted {date}", {
            date: formatDate(application.createdAt, true),
          })
        }}
      </p>
    </section>
    <section
      v-else-if="!loading && !error"
      class="dashboard-card application-empty"
    >
      <h2>{{ t("No application found") }}</h2>
      <p>
        {{ t("No site-admin application is associated with this account.") }}
      </p>
    </section>
    <div class="action-row application-actions">
      <button
        type="button"
        class="action-link"
        :disabled="loading"
        @click="refresh"
      >
        {{ t("Refresh status") }}
      </button>
      <button
        v-if="applicationOnly"
        type="button"
        class="action-link"
        :disabled="signingOut"
        @click="signOut"
      >
        {{ t("Sign out") }}
      </button>
      <RouterLink v-else class="action-link" to="/">{{
        t("Go to your workspace →")
      }}</RouterLink>
    </div>
    <p v-if="signOutError" role="alert">{{ t(signOutError) }}</p>
  </component>
</template>
<style scoped>
.admin-application-page {
  display: grid;
  gap: 20px;
  max-width: 760px;
  margin-inline: auto;
}
.application-heading {
  padding: 22px 26px;
  border: 1px solid #dfe9e2;
  border-radius: 18px;
  background: linear-gradient(110deg, #eef7f0, #fff);
}
.application-heading h1 {
  margin: 8px 0;
  color: #152742;
  font-size: clamp(26px, 3vw, 34px);
}
.application-heading p {
  margin: 0;
  color: #52677b;
  line-height: 1.6;
}
.managed-access-message {
  display: grid;
  gap: 8px;
  padding: 24px;
  border: 1px solid #dfe9e2;
  border-radius: 16px;
  background: #fff;
}
.managed-access-message h2,
.application-empty h2 {
  margin: 0;
  color: #152742;
}
.managed-access-message p,
.application-empty p {
  margin: 0;
  color: #52677b;
  line-height: 1.65;
}
.application-empty {
  padding: 24px;
}
.application-actions {
  flex-wrap: wrap;
}
</style>
