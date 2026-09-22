<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Bell, House, FileText, MapPin, Users, SquareCheck, Search, ChevronDown, Heart, Menu, X, ArrowUpRight } from '@lucide/vue';
import { useAuth } from '@/composables/useAuth';
import PlantArt from '@/components/dashboard/PlantArt.vue';
import AvatarPortrait from '@/components/dashboard/AvatarPortrait.vue';
import '@/styles/dashboard.css';

const route = useRoute();
const router = useRouter();
const { user } = useAuth();
const mobileOpen = ref(false);
const search = ref(String(route.query.q || ''));
watch(() => route.query.q, value => { search.value = String(value || ''); });
const detail = ref<HTMLDialogElement>();
const panel = ref('');
const preview = computed(() => route.path === '/preview');
const homePath = computed(() => preview.value ? '/preview' : '/');
const name = computed(() => user.value?.firstName || 'Sandrine');
const panels: Record<string, { title: string; description: string }[]> = {
  Sites: [{ title: 'Main Building', description: 'Sample site · 12 open reports' }, { title: 'West Wing', description: 'Sample site · 8 open reports' }, { title: 'North Facility', description: 'Sample site · 4 open reports' }],
  Technicians: [{ title: 'Alex Rivera · Plumbing', description: 'Sample technician · 3 assignments' }, { title: 'Priya Shah · Electrical', description: 'Sample technician · 2 assignments' }, { title: 'Marcus Lee · HVAC', description: 'Sample technician · 4 assignments' }],
  Notifications: [{ title: 'Water leak needs attention', description: 'Example notification · Main Building' }, { title: 'A repair is ready for confirmation', description: 'Example notification · West Wing' }],
  Testing: [{ title: 'Dashboard preview', description: 'The cards and chart use sample data. Live system checks are not connected.' }],
};
function openPanel(title: string) { panel.value = title; mobileOpen.value = false; detail.value?.showModal(); }
function runSearch() { router.push({ path: homePath.value, query: search.value.trim() ? { q: search.value.trim() } : {} }); }
</script>

<template>
  <div class="dashboard-app">
    <button v-if="mobileOpen" class="sidebar-scrim" aria-label="Close navigation" @click="mobileOpen = false" />
    <aside class="dashboard-sidebar" :class="{ 'is-open': mobileOpen }">
      <RouterLink :to="homePath" class="dashboard-brand" @click="mobileOpen = false"><span class="leaf-logo"><i></i><i></i><i></i></span><span>FixFlow<small>Spaces work better together</small></span></RouterLink>
      <nav aria-label="Main navigation">
        <RouterLink :to="homePath" :class="{ selected: route.path === '/' || preview }" @click="mobileOpen = false"><House :size="21" />Dashboard</RouterLink>
        <RouterLink :to="preview ? '/preview#recent-reports' : '/reports'" :class="{ selected: route.path === '/reports' }" @click="mobileOpen = false"><FileText :size="21" />Reports</RouterLink>
        <button @click="openPanel('Sites')"><MapPin :size="21" />Sites</button>
        <button @click="openPanel('Technicians')"><Users :size="21" />Technicians</button>
        <button @click="openPanel('Notifications')"><span class="notification-icon"><Bell :size="21" /><i /></span>Notifications</button>
        <button @click="openPanel('Testing')"><SquareCheck :size="21" />Testing</button>
      </nav>
      <div class="sidebar-garden"><PlantArt /><p>Well-maintained<br />spaces create<br /><strong>brighter days.</strong></p></div>
      <span class="sidebar-version">A little care. A big difference.</span>
    </aside>
    <div class="dashboard-workspace">
      <header class="dashboard-topbar">
        <button class="mobile-menu icon-button" aria-label="Open navigation" @click="mobileOpen = true"><Menu :size="22" /></button>
        <form class="dashboard-search" role="search" @submit.prevent="runSearch"><Search :size="19" /><input v-model="search" aria-label="Search reports" placeholder="Search reports" /><kbd>↵</kbd></form>
        <div class="topbar-account"><button class="icon-button notification-icon" aria-label="View notifications" @click="openPanel('Notifications')"><Bell :size="23" /><i /></button><span class="topbar-divider" /><RouterLink :to="preview ? '/login' : '/profile'" :aria-label="`${name}: ${preview ? 'sign in' : 'view profile'}`" class="account-link"><span class="user-avatar"><AvatarPortrait v-if="!user" initials="PS" /><template v-else>{{ name.charAt(0) }}</template></span><strong>{{ name }}</strong><ChevronDown :size="16" /></RouterLink></div>
      </header>
      <main class="dashboard-main"><RouterView /></main>
      <footer class="dashboard-footer"><span><b>FixFlow</b> © {{ new Date().getFullYear() }} FixFlow. Keeping spaces working beautifully.</span><span><Heart :size="13" fill="currentColor" /> Better spaces. Brighter tomorrows.</span></footer>
    </div>
    <dialog ref="detail" class="dashboard-dialog" :aria-label="panel" @click="(event) => { if (event.target === detail) detail?.close(); }">
      <div class="dialog-heading"><div><span class="section-eyebrow">DESIGN PREVIEW</span><h2>{{ panel }}</h2></div><button class="icon-button" aria-label="Close dialog" @click="detail?.close()"><X :size="22" /></button></div>
      <p class="dialog-intro">Sample content to explore the dashboard. Live data is not connected yet.</p>
      <div v-for="item in panels[panel]" :key="item.title" class="detail-list-item"><div><strong>{{ item.title }}</strong><p>{{ item.description }}</p></div><ArrowUpRight :size="18" /></div>
    </dialog>
  </div>
</template>
