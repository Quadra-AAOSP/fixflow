<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Bell, House, FileText, MapPin, Users, Search, ChevronDown, Heart, Menu, X, RefreshCw, ShieldCheck, Handshake, Wrench, ShoppingBag } from '@lucide/vue';
import { useAuth } from '@/composables/useAuth';
import { useMaintenanceStore } from '@/stores/maintenance';
import { useRealtimeStore } from '@/stores/realtime';
import LanguageSelector from '@/components/ui/LanguageSelector.vue';
import { useLocale } from '@/i18n';
import { canProvision } from '@/constants/access';
import { initials, formatDate } from '@/utils/maintenance';
import PlantArt from '@/components/dashboard/PlantArt.vue';
import '@/styles/dashboard.css';

const route = useRoute();
const router = useRouter();
const { user } = useAuth();
const data = useMaintenanceStore();
const realtime = useRealtimeStore();
const { t } = useLocale();
const mobileOpen = ref(false);
const search = ref(String(route.query.q || ''));
const notificationDialog = ref<HTMLDialogElement>();
const name = computed(() => [user.value?.firstName, user.value?.lastName].filter(Boolean).join(' '));
const links = computed(() => {
  if (user.value?.role === 'shop_manager') return [{ to: '/shop', label: 'Shop', icon: ShoppingBag }, { to: '/profile', label: 'Profile', icon: Users }];
  const technician = user.value?.role === 'technician';
  const items = technician
    ? [{ to: '/technician', label: 'My workspace', icon: Wrench }]
    : [{ to: '/', label: 'Dashboard', icon: House }];
  if (!technician || data.selectedSite) items.push({ to: '/reports', label: 'Reports', icon: FileText }, { to: '/sites', label: 'Sites', icon: MapPin }, { to: '/assignments', label: 'Assignments', icon: Users });
  if (technician || canProvision(user.value?.role)) items.push({ to: '/contracts', label: 'Site contracts', icon: Handshake });
  if (technician) items.push({ to: '/technician/invitations', label: 'Invitations', icon: Bell });
  if (user.value?.capabilities?.provision ?? canProvision(user.value?.role)) items.push({ to: '/team-access', label: 'Team access', icon: ShieldCheck });
  if (user.value?.adminApplication) items.push({ to: '/admin-application', label: 'My application', icon: ShieldCheck });
  items.push({ to: '/shop', label: 'Shop', icon: ShoppingBag });
  return items;
});
watch(() => route.query.q, value => { search.value = String(value || ''); });
onMounted(() => data.refresh());
function runSearch() { router.push({ name: 'reports', query: search.value.trim() ? { q: search.value.trim() } : {} }); }
</script>

<template>
  <div class="dashboard-app">
    <button v-if="mobileOpen" class="sidebar-scrim" :aria-label="t('Close navigation')" @click="mobileOpen = false" />
    <aside class="dashboard-sidebar" :class="{ 'is-open': mobileOpen }">
      <RouterLink to="/" class="dashboard-brand" @click="mobileOpen = false"><span class="leaf-logo"><i /><i /><i /></span><span>FixFlow<small>{{ t("Spaces work better together") }}</small></span></RouterLink>
      <nav :aria-label="t('Main navigation')"><RouterLink v-for="link in links" :key="link.to" :to="link.to" :class="{ selected: ['/', '/technician'].includes(link.to) ? route.path === link.to : route.path.startsWith(link.to) }" @click="mobileOpen = false"><component :is="link.icon" :size="21" />{{ t(link.label) }}</RouterLink></nav>
      <div class="sidebar-garden"><PlantArt /><p>{{ t('Well-maintained spaces create brighter days.') }}</p></div>
      <span class="sidebar-version">{{ t("A little care. A big difference.") }}</span>
    </aside>
    <div class="dashboard-workspace">
      <header class="dashboard-topbar"><button class="mobile-menu icon-button" :aria-label="t('Open navigation')" @click="mobileOpen = true"><Menu :size="22" /></button>
        <form class="dashboard-search" role="search" @submit.prevent="runSearch"><Search :size="19" /><input v-model="search" :aria-label="t('Search reports')" :placeholder="t('Search reports')" /><kbd>↵</kbd></form>
        <div class="topbar-account"><button class="icon-button" :aria-label="t('Notification availability')" @click="notificationDialog?.showModal()"><Bell :size="23" /></button><span class="topbar-divider" /><RouterLink to="/profile" :aria-label="t('{name}: view profile', { name })" class="account-link"><span class="user-avatar">{{ initials(name) }}</span><strong>{{ user?.firstName }}</strong><ChevronDown :size="16" /></RouterLink></div>
      </header>
      <main class="dashboard-main">
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
    <dialog ref="notificationDialog" class="dashboard-dialog" :aria-label="t('Notifications')"><div class="dialog-heading"><h2>{{ t("Notifications") }}</h2><button class="icon-button" :aria-label="t('Close dialog')" @click="notificationDialog?.close()"><X :size="22" /></button></div><p class="dialog-intro">{{ t("Notifications are not available yet. You can check current report statuses on the Reports page.") }}</p><RouterLink class="text-action" to="/reports" @click="notificationDialog?.close()">{{ t("View reports") }}</RouterLink></dialog>
  </div>
</template>
