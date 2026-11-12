<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { Bell, ChevronDown, Heart, Menu, X, RefreshCw } from '@lucide/vue';
import { useAuth } from '@/composables/useAuth';
import { useMaintenanceStore } from '@/stores/maintenance';
import { useRealtimeStore } from '@/stores/realtime';
import { useLocale } from '@/i18n';
import { initials, formatDate } from '@/utils/maintenance';
import WorkspaceNavigation from '@/components/dashboard/WorkspaceNavigation.vue';
import ShopNotifications from '@/components/dashboard/ShopNotifications.vue';
import NotificationFeed from '@/components/dashboard/NotificationFeed.vue';
import SkipLink from '@/components/ui/SkipLink.vue';
import { listNotifications, type ReportNotice } from '@/services/notifications';
import { errorMessage } from '@/services/api';
import { useNotificationIndicator } from '@/composables/useNotificationIndicator';
import { markNoticesSeen } from '@/utils/notificationSeen';
import '@/styles/dashboard.css';

const route = useRoute();
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
const notificationDialog = ref<HTMLDialogElement>();
const shopNoticeEpoch = ref(0);
const notificationsOpen = ref(false);
let noticeVersion = 0;
const notices = ref<ReportNotice[]>([]);
const noticeItems = computed(() => notices.value.map(notice => ({
  id: notice.id, createdAt: notice.createdAt,
  title: t(notice.type === 'site_invitation' ? 'Contract activity' : notice.type === 'work_completed' ? 'Work completed' : notice.type === 'report_edited' ? 'Report updated' : 'Report archived'),
  detail: t(notice.type === 'site_invitation' ? 'Contract activity' : notice.type === 'work_completed' ? 'Report #{id} is ready for your confirmation.' : notice.type === 'report_edited' ? 'Report #{id} was edited.' : 'Report #{id} was archived.', { id: notice.reportId ?? '' }),
  to: notice.type === 'site_invitation' ? '/contracts' : notice.type === 'report_deleted' || notice.reportId == null ? undefined : `/reports/${notice.reportId}`,
})));
const noticePage = ref(0);
const noticeRetryPage = ref(0);
const moreNotices = ref(false);
const loadingNotices = ref(false);
const noticeError = ref('');
async function loadNotices(page = 0) {
  if (loadingNotices.value) return;
  const current = ++noticeVersion;
  noticeRetryPage.value = page;
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
  if (user.value?.role !== 'shop_manager') void loadNotices();
}
watch(() => user.value?.id, () => { noticeVersion++; loadingNotices.value = false; notificationDialog.value?.close(); notificationsOpen.value = false; notices.value = []; noticeError.value = ''; moreNotices.value = false; shopNoticeEpoch.value = 0; });
const isShop = computed(() => route.path.startsWith('/shop'));
const name = computed(() => [user.value?.firstName, user.value?.lastName].filter(Boolean).join(' '));
onMounted(() => data.refresh());
const accountOpen = ref(false);
const accountMenu = ref<HTMLElement>();
const accountTrigger = ref<HTMLButtonElement>();
async function toggleAccount() {
  accountOpen.value = !accountOpen.value;
  if (accountOpen.value) { await nextTick(); accountMenu.value?.querySelector<HTMLElement>('a')?.focus(); }
}
function closeAccount(restoreFocus = false) {
  accountOpen.value = false;
  if (restoreFocus) accountTrigger.value?.focus();
}
function accountKey(event: KeyboardEvent) {
  const links = [...(accountMenu.value?.querySelectorAll<HTMLElement>('a') ?? [])];
  const index = links.indexOf(document.activeElement as HTMLElement);
  if (event.key === 'Escape') { event.preventDefault(); closeAccount(true); }
  else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? links.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length;
    links[next]?.focus();
  }
}
function outsideAccount(event: PointerEvent) {
  if (accountOpen.value && !accountMenu.value?.contains(event.target as Node) && !accountTrigger.value?.contains(event.target as Node)) closeAccount();
}
onMounted(() => document.addEventListener('pointerdown', outsideAccount));
onBeforeUnmount(() => document.removeEventListener('pointerdown', outsideAccount));
watch(() => route.fullPath, () => closeAccount());
</script>

<template>
  <div class="dashboard-app">
    <SkipLink />
    <aside class="dashboard-sidebar desktop-sidebar">
      <WorkspaceNavigation />
    </aside>
    <dialog id="mobile-navigation" ref="mobileNavigation" class="dashboard-sidebar mobile-sidebar" :aria-label="t('Main navigation')" @close="mobileOpen = false" @click="event => { if (event.target === mobileNavigation) closeNavigation(); }">
      <div class="mobile-navigation-heading"><button type="button" autofocus class="icon-button" :aria-label="t('Close navigation')" @click="closeNavigation"><X :size="22" /></button></div>
      <WorkspaceNavigation @navigate="closeNavigation" />
    </dialog>
    <div class="dashboard-workspace">
      <header class="dashboard-topbar"><button class="mobile-menu icon-button" :aria-label="t('Open navigation')" aria-controls="mobile-navigation" :aria-expanded="mobileOpen" @click="openNavigation"><Menu :size="22" /></button>
        <div class="topbar-account"><button class="icon-button notification-indicator-button" :aria-label="t(hasUnread ? 'Notifications, new notifications' : 'Notifications')" @click="openNotifications"><Bell :size="23" /><span v-if="hasUnread" class="notification-unread-dot" aria-hidden="true" /></button><span class="topbar-divider" /><div class="account-menu-container"><button ref="accountTrigger" type="button" :aria-label="t('Account menu')" aria-controls="account-menu" aria-haspopup="menu" :aria-expanded="accountOpen" class="account-link account-trigger" @click="toggleAccount" @keydown.down.prevent="!accountOpen && toggleAccount()" @keydown.esc="closeAccount(true)"><span class="user-avatar">{{ initials(name) }}</span><strong>{{ user?.firstName }}</strong><ChevronDown :size="16" /></button><div v-if="accountOpen" id="account-menu" ref="accountMenu" role="menu" :aria-label="t('Account menu')" class="account-menu" @keydown="accountKey"><RouterLink role="menuitem" to="/profile" @click="closeAccount()">{{ t('Profile') }}</RouterLink><RouterLink role="menuitem" to="/settings" @click="closeAccount()">{{ t('Settings') }}</RouterLink></div></div></div>
      </header>
      <main id="main-content" tabindex="-1" class="dashboard-main">
        <div v-if="!isShop && user?.role !== 'shop_manager'" class="workspace-context">
        <div class="live-toolbar"><label v-if="user?.role === 'super_admin' && data.sites.length" class="site-selector">{{ t("Site") }}<select :value="data.selectedSiteId" :disabled="data.loading" @change="data.selectSite(Number(($event.target as HTMLSelectElement).value))"><option v-for="site in data.sites" :key="site.id" :value="site.id">{{ site.name }}</option></select></label><span v-else>{{ data.selectedSite?.name || t(data.loading ? 'Loading your site…' : user?.role === 'technician' ? 'Technician account' : 'No site available') }}</span><span class="workspace-connection" role="status" :title="data.lastSynced ? t('Updated {date}', { date: formatDate(data.lastSynced, true) }) : t('Not synced')"><i :class="{ connected: realtime.state === 'connected' }" />{{ t(realtime.state === 'connected' ? 'Live updates connected' : realtime.state === 'connecting' ? 'Connecting…' : 'Live updates disconnected') }}</span><span class="live-sync"><span v-if="data.loading">{{ t('Refreshing…') }}</span><button v-if="realtime.state !== 'connected'" class="text-action manual-sync" :disabled="data.loading" :title="t('Fetch the latest site and report data')" @click="data.refresh()"><RefreshCw :size="16" />{{ t('Check for updates') }}</button></span></div>
        </div>
        <div v-if="!isShop && data.sitesError" class="live-error" role="alert">{{ t(data.sitesError) }} <button @click="data.refresh()">{{ t("Retry") }}</button></div>
        <p v-else-if="!isShop && !data.loading && !data.sites.length && user?.role !== 'technician' && user?.role !== 'shop_manager'" class="live-empty">{{ t("No sites are available for this account. Ask your administrator to check your site access.") }}</p>
        <div v-if="!isShop && user?.siteOnboarding?.setupRequired && user.siteOnboarding.canManageSubsites" class="draft-notice" role="status">
          {{ t("Your site needs a labelled building before reports can be submitted.") }}
          <RouterLink :to="`/sites/${user.siteOnboarding.siteId}/subsites`" class="text-action">{{ t("Set up buildings →") }}</RouterLink>
        </div>

        <RouterView />
      </main>
      <footer class="dashboard-footer"><span><b>FixFlow</b> {{ t('© {year} FixFlow. Keeping spaces working beautifully.', { year: new Date().getFullYear() }) }}</span><span><Heart :size="13" fill="currentColor" />{{ t("Better spaces. Brighter tomorrows.") }}</span></footer>
    </div>
    <dialog ref="notificationDialog" @close="notificationsOpen = false" class="dashboard-dialog" :aria-label="t('Notifications')">
      <div class="dialog-heading"><h2>{{ t('Notifications') }}</h2><button class="icon-button" :aria-label="t('Close dialog')" @click="notificationDialog?.close()"><X :size="22" /></button></div>
      <div class="notification-sections">
        <NotificationFeed v-if="user?.role !== 'shop_manager'" :title="t('Report updates')" :items="noticeItems" :loading="loadingNotices" :error="noticeError ? t(noticeError) : ''" :more="moreNotices" @retry="loadNotices(noticeRetryPage)" @more="loadNotices(noticePage + 1)" @navigate="notificationDialog?.close()" />
        <ShopNotifications v-if="notificationsOpen && user?.role !== 'reporter'" :key="shopNoticeEpoch" @navigate="notificationDialog?.close()" />
      </div>
    </dialog>
  </div>
</template>

<style scoped>
.workspace-context{display:flex;align-items:center;gap:20px;min-height:48px;padding:8px 0 14px;border-bottom:1px solid #dfe7e2;margin-bottom:20px}.workspace-context .live-toolbar{flex:1;justify-content:flex-start;gap:20px;margin:0;min-width:0}.workspace-context .workspace-language{margin:0;margin-left:auto;flex-shrink:0}.workspace-connection{display:inline-flex;align-items:center;gap:6px;font-size:11px;color:#52677b}.workspace-connection i{width:6px;height:6px;border-radius:50%;background:#b18a42}.workspace-connection i.connected{background:#008873}.workspace-context .live-sync{margin-left:auto}.workspace-context :deep(select){height:34px;min-height:34px;padding:5px 28px 5px 10px;font-size:12px}@media(max-width:700px){.workspace-context{gap:10px;align-items:start;flex-wrap:wrap}.workspace-context .live-toolbar{flex-wrap:wrap;gap:10px}.workspace-connection{font-size:10px}.workspace-context .live-sync{margin-left:0}.workspace-context .workspace-language{margin-left:0}}
.manual-sync{display:inline-flex;align-items:center;gap:6px}
@media(max-width:700px){.workspace-context{display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:16px;align-items:start}.workspace-context .live-toolbar{width:100%;min-width:0;gap:8px}.workspace-context .site-selector{width:100%;min-width:0;gap:8px}.workspace-context .site-selector select{min-width:0;width:100%;max-width:100%;flex:1}.workspace-context .workspace-language{max-width:100%;align-self:start}.workspace-context .workspace-language :deep(label){gap:6px}.workspace-context .workspace-language :deep(select){max-width:106px}.workspace-connection{max-width:100%;overflow-wrap:anywhere}}
.notification-sections{display:grid;gap:28px;margin-top:20px}
</style>

<style scoped>
.dashboard-topbar{justify-content:space-between}.topbar-account{margin-left:auto}.account-menu-container{position:relative}.account-trigger{min-height:44px;background:transparent;border:0;padding:4px;cursor:pointer}.account-menu{position:absolute;right:0;top:calc(100% + 8px);z-index:80;min-width:180px;padding:6px;background:#fff;border:1px solid #cddbd3;border-radius:12px;box-shadow:0 8px 20px #15274216}.account-menu a{display:flex;align-items:center;min-height:44px;padding:8px 14px;color:#233d36;border-radius:6px}.account-menu a:hover,.account-menu a:focus-visible{background:#e8f7f1}.workspace-context{display:block}@media(max-width:700px){.workspace-context{display:block}.workspace-context .live-toolbar{width:100%}}
</style>
