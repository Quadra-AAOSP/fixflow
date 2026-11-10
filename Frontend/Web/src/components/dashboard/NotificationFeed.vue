<script setup lang="ts">
import { Bell, ArrowUpRight } from '@lucide/vue';
import { useLocale } from '@/i18n';
import { formatDate } from '@/utils/maintenance';
import type { RouteLocationRaw } from 'vue-router';
export interface NotificationItem { id: number; title: string; detail: string; createdAt: string; to?: RouteLocationRaw }
defineProps<{ title: string; items: NotificationItem[]; loading: boolean; error: string; more: boolean }>();
defineEmits<{ retry: []; more: []; navigate: [] }>();
const { t } = useLocale();
</script>
<template>
  <section class="notification-feed" :aria-label="title" :aria-busy="loading">
    <div class="notification-feed-heading"><h3>{{ title }}</h3><span v-if="items.length">{{ items.length }}</span></div>
    <div v-if="error" class="live-error" role="alert"><p>{{ error }}</p><button type="button" class="text-action" :disabled="loading" @click="$emit('retry')">{{ t('Retry') }}</button></div>
    <div v-if="!loading && !error && !items.length" class="notification-empty"><Bell :size="24" aria-hidden="true" /><strong>{{ t('You’re all caught up') }}</strong><p>{{ t('New updates will appear here.') }}</p></div>
    <ul v-if="items.length" class="notification-items">
      <li v-for="item in items" :key="item.id">
        <RouterLink v-if="item.to" :to="item.to" class="notification-item" @click="$emit('navigate')"><span class="notification-item-copy"><strong>{{ item.title }}</strong><span>{{ item.detail }}</span><time :datetime="item.createdAt">{{ formatDate(item.createdAt, true) }}</time></span><ArrowUpRight :size="18" aria-hidden="true" /></RouterLink>
        <div v-else class="notification-item"><span class="notification-item-copy"><strong>{{ item.title }}</strong><span>{{ item.detail }}</span><time :datetime="item.createdAt">{{ formatDate(item.createdAt, true) }}</time></span></div>
      </li>
    </ul>
    <p v-if="loading" class="notification-loading" role="status">{{ t('Loading notifications…') }}</p>
    <button v-if="more" type="button" class="text-action notification-more" :disabled="loading" @click="$emit('more')">{{ t('Load more') }}</button>
  </section>
</template>
<style scoped>
.notification-feed{color:var(--product-ink);min-width:0}.notification-feed-heading{display:flex;align-items:center;gap:10px;margin-bottom:16px}.notification-feed-heading h3{font-size:16px;font-weight:700}.notification-feed-heading>span{padding:3px 8px;border-radius:20px;background:var(--mint);font-size:12px}.notification-items{display:grid;gap:8px;list-style:none;padding:0;margin:0}.notification-item{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:16px;border:1px solid var(--product-border);background:var(--product-surface);border-radius:12px;text-decoration:none;color:inherit}.notification-item[href]:hover{background:var(--product-paper);border-color:var(--mint)}.notification-item-copy{display:grid;gap:6px;min-width:0;overflow-wrap:anywhere}.notification-item strong{font-size:14px;font-weight:650}.notification-item-copy>span{font-size:14px;line-height:1.5}.notification-item time{font-size:12px;color:var(--product-muted)}.notification-item>svg{flex-shrink:0}.notification-empty{display:grid;justify-items:center;text-align:center;gap:12px;padding:28px 16px;background:var(--product-paper);border:1px dashed var(--product-border);border-radius:12px}.notification-empty>svg{color:var(--product-muted)}.notification-empty strong{font-size:14px}.notification-empty p,.notification-loading{font-size:14px;color:var(--product-muted)}.notification-loading,.notification-more{margin-top:16px}.live-error{margin-bottom:16px}
</style>
