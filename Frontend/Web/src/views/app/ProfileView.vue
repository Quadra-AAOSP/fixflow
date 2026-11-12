<script setup lang="ts">
import { useLocale } from "@/i18n";
import { ref } from "vue";
import TradeProfile from "@/components/technician/TradeProfile.vue";
import { useRouter } from "vue-router";
import { User } from "@lucide/vue";

import Button from "@/components/ui/Button.vue";
import { useAuth } from "@/composables/useAuth";
import { errorMessage } from "@/services/api";
import { roleLabels } from "@/constants/access";
import { colors } from "@/constants/theme";
const { t } = useLocale();

const router = useRouter();
const { user, logout } = useAuth();
const loggingOut = ref(false);
const error = ref("");

async function onLogout() {
  loggingOut.value = true;
  error.value = "";
  try {
    await logout();
    await router.replace({ name: "login" });
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    loggingOut.value = false;
  }
}
</script>

<template>
  <section class="profile-page">
    <header class="profile-heading">
      <span
        class="mb-3 inline-flex rounded-full bg-primary/15 p-4 dark:bg-primary-dark/20"
      >
        <User :size="36" :color="colors.light.primary" />
      </span>
      <h1 class="text-xl font-semibold text-ink dark:text-ink-dark">
        {{ user ? `${user.firstName} ${user.lastName}` : t("Profile") }}
      </h1>
      <p v-if="user" class="mt-1 text-sm text-muted dark:text-muted-dark">
        {{ user.email }}
      </p>
    </header>

    <div v-if="user" class="dashboard-card profile-facts">
      <div class="profile-fact">
        <span class="text-sm text-muted dark:text-muted-dark">{{
          t("Role")
        }}</span>
        <span
          class="text-sm font-medium capitalize text-ink dark:text-ink-dark"
        >
          {{ t(roleLabels[user.role]) }}
        </span>
      </div>
      <div class="profile-fact">
        <span class="text-sm text-muted dark:text-muted-dark">{{
          t("Site ID")
        }}</span>
        <span class="text-sm font-medium text-ink dark:text-ink-dark">
          {{ user.siteId != null ? user.siteId : "—" }}
        </span>
      </div>
      <div v-if="user.phone" class="profile-fact">
        <span class="text-sm text-muted dark:text-muted-dark">{{
          t("Phone")
        }}</span>
        <span class="text-sm font-medium text-ink dark:text-ink-dark">
          {{ user.phone }}
        </span>
      </div>
    </div>

    <section
      v-if="user?.role === 'technician'"
      class="dashboard-card profile-contracts"
    >
      <h2 class="font-semibold">{{ t("Site contracts are optional") }}</h2>
      <p class="dialog-intro">
        {{
          t(
            "Your account ID is {id}. Share it with a site administrator when arranging a contract. A site ID does not represent your contract list.",
            { id: user.id },
          )
        }}
      </p>
      <RouterLink to="/contracts" class="text-action">{{
        t("View contract options →")
      }}</RouterLink>
    </section>
    <details
      v-if="user?.role === 'technician'"
      class="dashboard-card profile-trades"
    >
      <summary>{{ t("Manage trade details") }}</summary>
      <TradeProfile />
    </details>
    <p v-if="error" role="alert" class="live-error">{{ t(error) }}</p>
    <Button
      label="Sign out"
      variant="secondary"
      :loading="loggingOut"
      @click="onLogout"
    />
  </section>
</template>

<style scoped>
.profile-page {
  max-width: 760px;
  margin-inline: auto;
  display: grid;
  gap: 20px;
}
.profile-heading {
  display: grid;
  justify-items: center;
  gap: 8px;
  padding: 28px 20px;
  text-align: center;
}
.profile-heading h1 {
  margin: 0;
  font-size: clamp(26px, 3vw, 34px);
  color: var(--ink, #152742);
}
.profile-heading p {
  margin: 0;
  color: var(--muted, #52677b);
}
.profile-facts {
  display: grid;
  gap: 0;
  padding: 8px 24px;
}
.profile-fact {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  padding: 16px 0;
  border-bottom: 1px solid #e8eeea;
}
.profile-fact:last-child {
  border-bottom: 0;
}
.profile-contracts,
.profile-trades {
  padding: 22px;
}
.profile-trades summary {
  cursor: pointer;
  font-weight: 700;
}
</style>
