<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Bell, House, FileText, MapPin, Users, Search, ChevronDown, Heart, Menu, X, RefreshCw, ShieldCheck, Handshake, Wrench } from '@lucide/vue';
import { useAuth } from '@/composables/useAuth';
import { useMaintenanceStore } from '@/stores/maintenance';
import { canProvision } from '@/constants/access';
import { initials, formatDate } from '@/utils/maintenance';
import PlantArt from '@/components/dashboard/PlantArt.vue';
import '@/styles/dashboard.css';

const route = useRoute();
const router = useRouter();
const { user } = useAuth();
const data = useMaintenanceStore();
const mobileOpen = ref(false);
const search = ref(String(route.query.q || ''));
const notificationDialog = ref<HTMLDialogElement>();
const name = computed(() => [user.value?.firstName, user.value?.lastName].filter(Boolean).join(' '));
const links = computed(() => {
  const technician = user.value?.role === 'technician';
  const items = technician
    ? [{ to: '/technician', label: 'My workspace', icon: Wrench }]
    : [{ to: '/', label: 'Dashboard', icon: House }];
  if (!technician || data.selectedSite) items.push({ to: '/reports', label: 'Reports', icon: FileText }, { to: '/sites', label: 'Sites', icon: MapPin }, { to: '/assignments', label: 'Assignments', icon: Users });
  if (technician || canProvision(user.value?.role)) items.push({ to: '/contracts', label: 'Site contracts', icon: Handshake });
  if (canProvision(user.value?.role)) items.push({ to: '/team-access', label: 'Team access', icon: ShieldCheck });
  return items;
});
watch(() => route.query.q, value => { search.value = String(value || ''); });
onMounted(() => data.refresh());
function runSearch() { router.push({ name: 'reports', query: search.value.trim() ? { q: search.value.trim() } : {} }); }
</script>

<template>
  <div class="dashboard-app">
    <button v-if="mobileOpen" class="sidebar-scrim" aria-label="Close navigation" @click="mobileOpen = false" />
    <aside class="dashboard-sidebar" :class="{ 'is-open': mobileOpen }">
      <RouterLink to="/" class="dashboard-brand" @click="mobileOpen = false"><span class="leaf-logo"><i /><i /><i /></span><span>FixFlow<small>Spaces work better together</small></span></RouterLink>
      <nav aria-label="Main navigation"><RouterLink v-for="link in links" :key="link.to" :to="link.to" :class="{ selected: link.to === '/' ? route.path === '/' : route.path.startsWith(link.to) }" @click="mobileOpen = false"><component :is="link.icon" :size="21" />{{ link.label }}</RouterLink></nav>
      <div class="sidebar-garden"><PlantArt /><p>Well-maintained<br />spaces create<br /><strong>brighter days.</strong></p></div>
      <span class="sidebar-version">A little care. A big difference.</span>
    </aside>
    <div class="dashboard-workspace">
      <header class="dashboard-topbar"><button class="mobile-menu icon-button" aria-label="Open navigation" @click="mobileOpen = true"><Menu :size="22" /></button>
        <form class="dashboard-search" role="search" @submit.prevent="runSearch"><Search :size="19" /><input v-model="search" aria-label="Search reports" placeholder="Search reports" /><kbd>↵</kbd></form>
        <div class="topbar-account"><button class="icon-button" aria-label="Notification availability" @click="notificationDialog?.showModal()"><Bell :size="23" /></button><span class="topbar-divider" /><RouterLink to="/profile" :aria-label="`${name}: view profile`" class="account-link"><span class="user-avatar">{{ initials(name) }}</span><strong>{{ user?.firstName }}</strong><ChevronDown :size="16" /></RouterLink></div>
      </header>
      <main class="dashboard-main">
        <div class="live-toolbar"><label v-if="user?.role === 'super_admin' && data.sites.length" class="site-selector">Site<select :value="data.selectedSiteId" :disabled="data.loading" @change="data.selectSite(Number(($event.target as HTMLSelectElement).value))"><option v-for="site in data.sites" :key="site.id" :value="site.id">{{ site.name }}</option></select></label><span v-else>{{ data.selectedSite?.name || (data.loading ? 'Loading your site…' : user?.role === 'technician' ? 'Technician account' : 'No site available') }}</span><span class="live-sync">{{ data.loading ? 'Refreshing…' : data.lastSynced ? `Updated ${formatDate(data.lastSynced, true)}` : 'Not synced' }}<button class="icon-button" :disabled="data.loading" aria-label="Refresh live data" @click="data.refresh()"><RefreshCw :size="16" /></button></span></div>
        <div v-if="data.sitesError" class="live-error" role="alert">{{ data.sitesError }} <button @click="data.refresh()">Retry</button></div>
        <p v-else-if="!data.loading && !data.sites.length && user?.role !== 'technician'" class="live-empty">No sites are available for this account. Ask your administrator to check your site access.</p>
        <RouterView />
      </main>
      <footer class="dashboard-footer"><span><b>FixFlow</b> © {{ new Date().getFullYear() }} FixFlow. Keeping spaces working beautifully.</span><span><Heart :size="13" fill="currentColor" />Better spaces. Brighter tomorrows.</span></footer>
    </div>
    <dialog ref="notificationDialog" class="dashboard-dialog" aria-label="Notifications"><div class="dialog-heading"><h2>Notifications</h2><button class="icon-button" aria-label="Close dialog" @click="notificationDialog?.close()"><X :size="22" /></button></div><p class="dialog-intro">Notifications are not available yet. You can check current report statuses on the Reports page.</p><RouterLink class="text-action" to="/reports" @click="notificationDialog?.close()">View reports</RouterLink></dialog>
  </div>
</template>
