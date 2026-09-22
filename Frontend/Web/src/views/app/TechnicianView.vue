<script setup lang="ts">
import { computed } from 'vue';
import { Wrench, Handshake, UserRound, ArrowRight } from '@lucide/vue';
import { useAuth } from '@/composables/useAuth';
import { useMaintenanceStore } from '@/stores/maintenance';
const { user } = useAuth();
const data = useMaintenanceStore();
const accessibleAssigned = computed(() => data.reports.filter(report => report.assignedTechnicianId === user.value?.id));
</script>
<template>
  <section class="welcome-banner"><div class="welcome-copy"><h1>Your technician workspace<template v-if="user?.firstName">, {{ user.firstName }}</template></h1><p>Your skills. Your choice of sites.</p></div><Wrench :size="43" /></section>
  <div class="technician-grid"><section class="dashboard-card"><span class="stat-icon mint"><UserRound :size="28" /></span><h2>Independent by default</h2><p>New technician accounts start without a site or any site contracts. A contract is optional; you can keep your account without signing one.</p><RouterLink to="/profile" class="text-action">View your account <ArrowRight :size="15" /></RouterLink></section><section class="dashboard-card"><span class="stat-icon citron"><Handshake :size="28" /></span><h2>Work with a site</h2><p>A site contract is a separate agreement approved by a site administrator. It is never created automatically during registration.</p><RouterLink to="/contracts" class="text-action">Site contract options <ArrowRight :size="15" /></RouterLink></section></div>
  <section class="dashboard-card"><h2>Assigned work</h2><p v-if="data.loading" class="dialog-intro">Loading available work…</p><p v-else-if="data.reportsLoaded" class="dialog-intro">{{ accessibleAssigned.length }} reports are assigned to you at {{ data.selectedSite?.name }}.</p><p v-else class="dialog-intro">No site-scoped work is available to load for this account. Independent marketplace listings and contract-based job access are not available in this version.</p><RouterLink v-if="data.reportsLoaded" to="/assignments" class="text-action">View assignments →</RouterLink></section>
</template>
