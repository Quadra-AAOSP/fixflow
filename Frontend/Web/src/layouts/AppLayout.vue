<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Bell, Search, ChevronDown, Heart, Menu, X, RefreshCw } from '@lucide/vue';
import { useAuth } from '@/composables/useAuth';
import { useMaintenanceStore } from '@/stores/maintenance';
import { useRealtimeStore } from '@/stores/realtime';
import LanguageSelector from '@/components/ui/LanguageSelector.vue';
import { useLocale } from '@/i18n';
import { initials, formatDate } from '@/utils/maintenance';
import WorkspaceNavigation from '@/components/dashboard/WorkspaceNavigation.vue';
import ShopNotifications from '@/components/dashboard/ShopNotifications.vue';
import SkipLink from '@/components/ui/SkipLink.vue';
import { listNotifications, type ReportNotice } from '@/services/notifications';
import { errorMessage } from '@/services/api';
import { useNotificationIndicator } from '@/composables/useNotificationIndicator';
import { markNoticesSeen } from '@/utils/notificationSeen';
import '@/styles/dashboard.css';

const route = useRoute();
const router = useRouter();
const { user } = useAuth();
const { hasUnread } = useNotificationIndicator();
const data = useMaintenanceStore();
const realtime = useRealtimeStore();
const { t } = useLocale();
const mobileOpen = ref(false);
const mobileNavigation = ref<HTMLDialogElement>();
let mobileQuery: MediaQueryList | undefined;
function closeNavigation() { mobileNavigation.value?.close(); }
function openNavigation() { mobileNavigation.value?.showModal(); mobileOpen.value = true; }
function adaptNavigation() { if (!mobileQuery?.matches) closeNavigation(); }
onMounted(() => { mobileQuery = window.matchMedia('(max-width: 800px)'); mobileQuery.addEventListener('change', adaptNavigation); });
onBeforeUnmount(() => mobileQuery?.removeEventListener('change', adaptNavigation));
watch(() => route.fullPath, closeNavigation);
const search = ref(String(route.query.q || ''));
const notificationDialog = ref<HTMLDialogElement>();
const shopNoticeEpoch = ref(0);
const notificationsOpen = ref(false);
let noticeVersion = 0;
const notices = ref<ReportNotice[]>([]);
const noticePage = ref(0);
const moreNotices = ref(false);
const loadingNotices = ref(false);
const noticeError = ref('');
async function loadNotices(page = 0) {
  if (loadingNotices.value) return;
  const current = ++noticeVersion;
  loadingNotices.value = true;
  noticeError.value = '';
  const accountId = user.value?.id;
  try {
    const result = await listNotifications(page);
    if (current !== noticeVersion || accountId !== user.value?.id || !notificationDialog.value?.open) return;
    if (accountId != null) void markNoticesSeen(accountId, 'reports', result.content);
    notices.value = page === 0 ? result.content
      : [...notices.value, ...result.content.filter(item => !notices.value.some(notice => notice.id === item.id))];
    noticePage.value = page;
    moreNotices.value = result.hasMore;
  } catch (err) { if (current === noticeVersion && accountId === user.value?.id) noticeError.value = errorMessage(err); }
  finally { if (current === noticeVersion) loadingNotices.value = false; }
}
function openNotifications() {
  notificationDialog.value?.showModal();
  notificationsOpen.value = true;
  shopNoticeEpoch.value++;
  void loadNotices();
}
watch(() => user.value?.id, () => { noticeVersion++; loadingNotices.value = false; notificationDialog.value?.close(); notificationsOpen.value = false; notices.value = []; noticeError.value = ''; moreNotices.value = false; shopNoticeEpoch.value = 0; });
const canBrowseReports = computed(() => !!user.value && user.value.role !== 'shop_manager' && (user.value.role !== 'technician' || !!data.selectedSite));
const name = computed(() => [user.value?.firstName, user.value?.lastName].filter(Boolean).join(' '));
watch(() => route.query.q, value => { search.value = String(value || ''); });
onMounted(() => data.refresh());
function runSearch() { router.push({ name: 'reports', query: search.value.trim() ? { q: search.value.trim() } : {} }); }
</script>

<template>
  <div class="dashboard-app">
    <SkipLink />
    <aside class="dashboard-sidebar desktop-sidebar">
      <WorkspaceNavigation />
    </aside>
    <dialog id="mobile-navigation" ref="mobileNavigation" class="dashboard-sidebar mobile-sidebar" :aria-label="t('Main navigation')" @close="mobileOpen = false" @click="event => { if (event.target === mobileNavigation) closeNavigation(); }">
      <div class="mobile-navigation-heading"><strong>{{ t('Navigation') }}</strong><button type="button" autofocus class="icon-button" :aria-label="t('Close navigation')" @click="closeNavigation"><X :size="22" /></button></div>
      <WorkspaceNavigation @navigate="closeNavigation" />
    </dialog>
    <div class="dashboard-workspace">
      <header class="dashboard-topbar"><button class="mobile-menu icon-button" :aria-label="t('Open navigation')" aria-controls="mobile-navigation" :aria-expanded="mobileOpen" @click="openNavigation"><Menu :size="22" /></button>
        <form v-if="canBrowseReports" class="dashboard-search" role="search" @submit.prevent="runSearch"><Search :size="19" /><input v-model="search" :aria-label="t('Search reports')" :placeholder="t('Search reports')" /><kbd>↵</kbd></form>
        <div class="topbar-account"><button v-if="user?.role !== 'shop_manager'" class="icon-button notification-indicator-button" :aria-label="t(hasUnread ? 'Notifications, new notifications' : 'Notifications')" @click="openNotifications"><Bell :size="23" /><span v-if="hasUnread" class="notification-unread-dot" aria-hidden="true" /></button><span class="topbar-divider" /><RouterLink to="/profile" :aria-label="t('{name}: view profile', { name })" class="account-link"><span class="user-avatar">{{ initials(name) }}</span><strong>{{ user?.firstName }}</strong><ChevronDown :size="16" /></RouterLink></div>
      </header>
      <main id="main-content" tabindex="-1" class="dashboard-main">
        <div class="workspace-language"><LanguageSelector /></div>
        <div v-if="user?.role !== 'shop_manager'" class="live-toolbar"><label v-if="user?.role === 'super_admin' && data.sites.length" class="site-selector">{{ t("Site") }}<select :value="data.selectedSiteId" :disabled="data.loading" @change="data.selectSite(Number(($event.target as HTMLSelectElement).value))"><option v-for="site in data.sites" :key="site.id" :value="site.id">{{ site.name }}</option></select></label><span v-else>{{ data.selectedSite?.name || t(data.loading ? 'Loading your site…' : user?.role === 'technician' ? 'Technician account' : 'No site available') }}</span><span class="live-sync">{{ data.loading ? t('Refreshing…') : data.lastSynced ? t('Updated {date}', { date: formatDate(data.lastSynced, true) }) : t('Not synced') }}<button class="icon-button" :disabled="data.loading" :aria-label="t('Refresh live data')" @click="data.refresh()"><RefreshCw :size="16" /></button></span></div>
        <div v-if="data.sitesError" class="live-error" role="alert">{{ t(data.sitesError) }} <button @click="data.refresh()">{{ t("Retry") }}</button></div>
        <p v-else-if="!data.loading && !data.sites.length && user?.role !== 'technician' && user?.role !== 'shop_manager'" class="live-empty">{{ t("No sites are available for this account. Ask your administrator to check your site access.") }}</p>
        <div v-if="user?.siteOnboarding?.setupRequired && user.siteOnboarding.canManageSubsites" class="draft-notice" role="status">
          {{ t("Your site needs a labelled building before reports can be submitted.") }}
          <RouterLink :to="`/sites/${user.siteOnboarding.siteId}/subsites`" class="text-action">{{ t("Set up buildings →") }}</RouterLink>
        </div>
        <p v-if="user?.role !== 'shop_manager'" class="dialog-intro" role="status">{{ t(realtime.state === 'connected' ? 'Live updates connected' : realtime.state === 'connecting' ? 'Connecting and rechecking access…' : 'Live updates disconnected. Use refresh to check current data.') }}</p>
        <RouterView />
      </main>
      <footer class="dashboard-footer"><span><b>FixFlow</b> {{ t('© {year} FixFlow. Keeping spaces working beautifully.', { year: new Date().getFullYear() }) }}</span><span><Heart :size="13" fill="currentColor" />{{ t("Better spaces. Brighter tomorrows.") }}</span></footer>
    </div>
    <dialog ref="notificationDialog" @close="notificationsOpen = false" class="dashboard-dialog" :aria-label="t('Notifications')">
      <div class="dialog-heading"><h2>{{ t('Notifications') }}</h2><button class="icon-button" :aria-label="t('Close dialog')" @click="notificationDialog?.close()"><X :size="22" /></button></div>
      <ShopNotifications v-if="notificationsOpen && user?.role !== 'reporter'" :key="shopNoticeEpoch" /><p v-if="noticeError" class="live-error" role="alert">{{ t(noticeError) }} <button @click="loadNotices()">{{ t('Retry') }}</button></p>
      <p v-if="loadingNotices" role="status" class="dialog-intro">{{ t('Loading notifications…') }}</p>
      <p v-else-if="!notices.length && !noticeError" class="dialog-intro">{{ t('No notifications yet.') }}</p>
      <ul v-if="notices.length" class="reporter-list">
        <li v-for="notice in notices" :key="notice.id">
          <RouterLink v-if="notice.type === 'work_completed'" :to="`/reports/${notice.reportId}`" @click="notificationDialog?.close()">{{ t('Report #{id} is ready for your confirmation.', { id: notice.reportId }) }}</RouterLink>
          <template v-else>{{ t(notice.type === 'report_edited' ? 'Report #{id} was edited.' : 'Report #{id} was archived.', { id: notice.reportId }) }}</template>
          <span>{{ formatDate(notice.createdAt, true) }}</span>
        </li>
      </ul>
      <button v-if="moreNotices" class="text-action" :disabled="loadingNotices" @click="loadNotices(noticePage + 1)">{{ t('Load more') }}</button>
    </dialog>
  </div>
</template>
