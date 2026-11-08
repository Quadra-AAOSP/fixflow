import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useAuth } from '@/composables/useAuth';
import { listNotifications } from '@/services/notifications';
import { listShopNotifications } from '@/services/shop';
import { readSeen, subscribeSeen, type NoticeFeed } from '@/utils/notificationSeen';

export function useNotificationIndicator(feeds: NoticeFeed[] = ['reports', 'shop']) {
  const { user } = useAuth();
  const unread = ref(false);
  let version = 0;
  let timer: ReturnType<typeof setInterval> | undefined;
  async function refresh() {
    const current = ++version;
    const id = user.value?.id;
    if (id == null || user.value?.applicationOnly) { unread.value = false; return; }
    const active = feeds.filter(feed => feed !== 'reports' || user.value?.role !== 'shop_manager');
    const seen = await readSeen(id);
    const results = await Promise.allSettled(active.map(async feed => {
      const result = await (feed === 'reports' ? listNotifications(0) : listShopNotifications(0));
      return result.content.some(notice => notice.id > seen[feed]);
    }));
    if (version !== current || user.value?.id !== id) return;
    // A failed refresh must not erase an already displayed indicator.
    if (results.some(result => result.status === 'fulfilled' && result.value)) unread.value = true;
    else if (results.every(result => result.status === 'fulfilled')) unread.value = false;
  }
  watch(() => [user.value?.id, user.value?.role], () => { unread.value = false; void refresh(); }, { immediate: true });
  const unsubscribe = subscribeSeen(() => { void refresh(); });
  onMounted(() => { timer = setInterval(() => { if (!document.hidden) void refresh(); }, 30000); window.addEventListener('focus', refresh); });
  onBeforeUnmount(() => { version++; if (timer) clearInterval(timer); unsubscribe(); window.removeEventListener('focus', refresh); });
  return { hasUnread: computed(() => unread.value), refresh };
}
