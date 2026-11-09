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
import SkipLink from '@/components/ui/SkipLink.vue';
import NotificationsPanel from '@/components/NotificationsPanel.vue';
import '@/styles/dashboard.css';

const route = useRoute();
const router = useRouter();
const { user } = useAuth();
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
      <div class="mobile-navigation-heading"><button type="button" autofocus class="icon-button" :aria-label="t('Close navigation')" @click="closeNavigation"><X :size="22" /></button></div>
      <WorkspaceNavigation @navigate="closeNavigation" />
    </dialog>
    <div class="dashboard-workspace">
      <header class="dashboard-topbar"><button class="mobile-menu icon-button" :aria-label="t('Open navigation')" aria-controls="mobile-navigation" :aria-expanded="mobileOpen" @click="openNavigation"><Menu :size="22" /></button>
        <form v-if="canBrowseReports" class="dashboard-search" role="search" @submit.prevent="runSearch"><Search :size="19" /><input v-model="search" :aria-label="t('Search reports')" :placeholder="t('Search reports')" /><kbd>↵</kbd></form>
        <div class="topbar-account"><button v-if="canBrowseReports" class="icon-button" :aria-label="t('Notification availability')" @click="notificationDialog?.showModal()"><Bell :size="23" /></button><span class="topbar-divider" /><RouterLink to="/profile" :aria-label="t('{name}: view profile', { name })" class="account-link"><span class="user-avatar">{{ initials(name) }}</span><strong>{{ user?.firstName }}</strong><ChevronDown :size="16" /></RouterLink></div>
      </header>
      <main id="main-content" tabindex="-1" class="dashboard-main">
        <div class="workspace-language"><LanguageSelector /></div>
        <div v-if="user?.role !== 'shop_manager'" class="live-toolbar"><label v-if="user?.role === 'super_admin' && data.sites.length" class="site-selector">{{ t("Site") }}<select :value="data.selectedSiteId" :disabled="data.loading" @change="data.selectSite(Number(($event.target as HTMLSelectElement).value))"><option v-for="site in data.sites" :key="site.id" :value="site.id">{{ site.name }}</option></select></label><span v-else>{{ data.selectedSite?.name || t(data.loading ? 'Loading your site…' : user?.role === 'technician' ? 'Technician account' : 'No site available') }}</span><span class="live-sync">{{ data.loading ? t('Refreshing…') : data.lastSynced ? t('Updated {date}', { date: formatDate(data.lastSynced, true) }) : t('Not synced') }}<button class="icon-button" :disabled="data.loading" :aria-label="t('Refresh live data')" :title="t('Fetch the latest site and report data')" @click="data.refresh()"><RefreshCw :size="16" /></button></span></div>
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
    <dialog ref="notificationDialog" class="dashboard-dialog" :aria-label="t('Notifications')"><div class="dialog-heading"><h2>{{ t("Notifications") }}</h2><button class="icon-button" :aria-label="t('Close dialog')" @click="notificationDialog?.close()"><X :size="22" /></button></div><NotificationsPanel @close="notificationDialog?.close()" /></dialog>
  </div>
</template>
