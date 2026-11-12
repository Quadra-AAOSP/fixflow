<script setup lang="ts">
import LoadingStatus from "@/components/ui/LoadingStatus.vue";
import { useLocale } from "@/i18n";
import { onBeforeUnmount, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useAuth } from "@/composables/useAuth";
import {
  getTechnicianInvitations,
  getTechnicianInvitation,
} from "@/services/technician";
import { errorMessage } from "@/services/api";
import { formatDate, humanize } from "@/utils/maintenance";
import type { TechnicianInvitationInbox } from "@/types/technician";
const { t } = useLocale();
const route = useRoute();

const { user } = useAuth();
const inbox = ref<TechnicianInvitationInbox | null>(null);
const loading = ref(false);
const error = ref("");
const requestedPage = ref(0);
let generation = 0;
onBeforeUnmount(() => {
  generation++;
});
async function load(page = 0) {
  const current = ++generation;
  requestedPage.value = page;
  inbox.value = null;
  error.value = "";
  loading.value = false;
  if (user.value?.role !== "technician") return;
  loading.value = true;
  try {
    const id = Number(route.query.invitationId);
    const result =
      id > 0
        ? {
            items: [await getTechnicianInvitation(id)],
            page: 0,
            hasNext: false,
          }
        : await getTechnicianInvitations(page);
    if (current === generation) inbox.value = result;
  } catch (err) {
    if (current === generation) error.value = errorMessage(err);
  } finally {
    if (current === generation) loading.value = false;
  }
}
watch(
  () => [user.value?.id, user.value?.role, route.query.invitationId],
  () => load(),
  { immediate: true },
);
</script>

<template>
  <div v-if="user?.role === 'technician'" class="invitations-page">
    <header class="invitations-header">
      <div>
        <h1>{{ t("Site invitations") }}</h1>
        <p>{{ t("Invitations to discuss a site contract") }}</p>
      </div>
      <button
        type="button"
        class="action-link"
        :disabled="loading"
        @click="load(inbox?.page ?? 0)"
      >
        {{ t("Refresh inbox") }}
      </button>
    </header>
    <section class="dashboard-card invitations-content">
      <p class="invitations-intro">
        {{
          t(
            "These invitations do not assign work or create contracts. You can review the site’s message and choose whether to request a contract, or remain independent.",
          )
        }}
      </p>
      <LoadingStatus v-if="loading" :label="t('Loading invitations…')" />
      <p v-if="error" role="alert" class="live-error">
        {{ t(error) }}
        <button type="button" @click="load(requestedPage)">
          {{ t("Try again") }}
        </button>
      </p>
      <template v-if="inbox && !loading"
        ><p v-if="!inbox.items.length" class="live-empty">
          {{ t("No invitations on this page.") }}
        </p>
        <ul class="invitations-list">
          <li v-for="item in inbox.items" :key="item.id">
            <div class="invitation-title">
              <div>
                <h2>{{ t("Site #{id}", { id: item.siteId }) }}</h2>
                <p>
                  {{ t(humanize(item.category))
                  }}<template v-if="item.specialty">
                    · {{ t(humanize(item.specialty)) }}</template
                  >
                </p>
              </div>
              <span>{{
                t("Received {date}", { date: formatDate(item.createdAt, true) })
              }}</span>
            </div>
            <p class="invitation-reason">{{ item.reason }}</p>
            <RouterLink
              class="text-action"
              :to="{ name: 'contracts', query: { siteId: item.siteId } }"
              >{{ t("Review a site contract request →") }}</RouterLink
            >
          </li>
        </ul>
        <nav class="invitation-pagination" :aria-label="t('Invitation pages')">
          <button
            class="text-action"
            type="button"
            :disabled="inbox.page === 0"
            @click="load(inbox.page - 1)"
          >
            {{ t("Previous") }}</button
          ><span>{{ t("Page {page}", { page: inbox.page + 1 }) }}</span
          ><button
            class="text-action"
            type="button"
            :disabled="!inbox.hasNext"
            @click="load(inbox.page + 1)"
          >
            {{ t("Next") }}
          </button>
        </nav></template
      >
    </section>
  </div>
</template>
<style scoped>
.invitations-page {
  display: grid;
  gap: 24px;
}
.invitations-header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 20px;
  padding: 10px 0 24px;
  border-bottom: 1px solid #e0e9e4;
}
.invitations-header h1 {
  font-size: 32px;
  font-weight: 700;
  letter-spacing: -0.03em;
}
.invitations-header p,
.invitations-intro {
  color: #52677b;
  margin-top: 6px;
  line-height: 1.6;
}
.invitations-content {
  padding: 24px;
}
.invitations-intro {
  max-width: 760px;
  margin: 0 0 22px;
}
.invitations-list {
  display: grid;
  gap: 12px;
}
.invitations-list li {
  border: 1px solid #e0e9e4;
  border-radius: 10px;
  padding: 20px;
}
.invitation-title {
  display: flex;
  justify-content: space-between;
  gap: 15px;
}
.invitation-title h2 {
  font-size: 18px;
  font-weight: 700;
}
.invitation-title p,
.invitation-title span {
  color: #52677b;
  font-size: 13px;
}
.invitation-reason {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  margin: 16px 0;
}
.invitation-pagination button:disabled { color: #788b94; opacity: .55; cursor: not-allowed; }
.invitation-pagination {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin-top: 20px;
}
@media (max-width: 650px) {
  .invitations-header,
  .invitation-title {
    align-items: start;
    flex-direction: column;
  }
  .invitations-content {
    padding: 16px;
  }
}
</style>
