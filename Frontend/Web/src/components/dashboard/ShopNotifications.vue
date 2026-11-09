<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from "vue";
import { useAuth } from "@/composables/useAuth";
import { useLocale } from "@/i18n";
import { listShopNotifications } from "@/services/shop";
import type { ShopNotice } from "@/types/shop";
import { markNoticesSeen } from '@/utils/notificationSeen';
const { user } = useAuth();
const { t } = useLocale();
const notices = ref<ShopNotice[]>([]);
const loading = ref(false);
const error = ref(false);
const more = ref(false);
const page = ref(0);
let generation = 0;
async function load(next = 0) {
  const current = ++generation;
  const accountId = user.value?.id;
  if (!user.value) {
    notices.value = [];
    return;
  }
  loading.value = true;
  error.value = false;
  try {
    const result = await listShopNotifications(next);
    if (current === generation && accountId === user.value?.id) {
      if (accountId != null) void markNoticesSeen(accountId, 'shop', result.content);
      notices.value = next
        ? [...notices.value, ...result.content]
        : result.content;
      more.value = result.hasMore;
      page.value = next;
    }
  } catch {
    if (current === generation) error.value = true;
  } finally {
    if (current === generation) loading.value = false;
  }
}
watch(
  () => [user.value?.id, user.value?.role],
  () => {
    notices.value = [];
    more.value = false;
    page.value = 0;
    void load();
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  generation++;
});
</script>
<template>
  <section>
    <h3>{{ t("Shop notifications") }}</h3>
    <p v-if="loading" role="status">{{ t("Loading notifications…") }}</p>
    <p v-if="error" role="alert">
      {{ t("Could not load shop notifications.") }}
      <button @click="load()">{{ t("Retry") }}</button>
    </p>
    <p v-if="!loading && !error && !notices.length">
      {{ t("No shop notifications yet.") }}
    </p>
    <ul>
      <li v-for="notice in notices" :key="notice.id">
        <RouterLink
          :to="
            notice.type === 'order_placed'
              ? {
                  name: 'shop-managed-order',
                  params: { orderId: notice.orderId },
                }
              : { name: 'shop-order', params: { orderId: notice.orderId } }
          "
          >{{
            t(notice.type === "order_placed" ? "New order" : "Order shipped")
          }}
          · {{ notice.orderId }}</RouterLink
        >
        · {{ notice.createdAt }}
      </li>
    </ul>
    <button v-if="more" :disabled="loading" @click="load(page + 1)">
      {{ t("Load more") }}
    </button>
  </section>
</template>
