<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from "vue";
import { useAuth } from "@/composables/useAuth";
import { useLocale } from "@/i18n";
import { listShopNotifications } from "@/services/shop";
import type { ShopNotice } from "@/types/shop";
import { markNoticesSeen } from '@/utils/notificationSeen';
import NotificationFeed from './NotificationFeed.vue';
const { user } = useAuth();
const { t } = useLocale();
const notices = ref<ShopNotice[]>([]);
const loading = ref(false);
const error = ref(false);
const emit = defineEmits<{ navigate: [] }>();
const items = computed(() => notices.value.map(notice => ({
  id: notice.id, createdAt: notice.createdAt,
  title: t(notice.type === 'order_placed' ? 'New order' : 'Order shipped'),
  detail: t('Order #{id}', { id: notice.orderId }),
  to: { name: notice.type === 'order_placed' && ['shop_manager', 'super_admin'].includes(user.value?.role ?? '') ? 'shop-managed-order' : 'shop-order', params: { orderId: notice.orderId } },
})));
const more = ref(false);
const page = ref(0);
const retryPage = ref(0);
let generation = 0;
async function load(next = 0) {
  if (loading.value) return;
  const current = ++generation;
  const accountId = user.value?.id;
  if (!user.value) {
    notices.value = [];
    return;
  }
  retryPage.value = next;
  loading.value = true;
  error.value = false;
  try {
    const result = await listShopNotifications(next);
    if (current === generation && accountId === user.value?.id) {
      if (accountId != null) void markNoticesSeen(accountId, 'shop', result.content);
      notices.value = next
        ? [...notices.value, ...result.content.filter(item => !notices.value.some(existing => existing.id === item.id))]
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
    generation++;
    loading.value = false;
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
  <NotificationFeed :title="t('Shop notifications')" :items="items" :loading="loading" :error="error ? t('Could not load shop notifications.') : ''" :more="more" @retry="load(retryPage)" @more="load(page + 1)" @navigate="emit('navigate')" />
</template>
