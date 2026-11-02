<script setup lang="ts">
import { useLocale } from '@/i18n';
import TradeProfile from '@/components/technician/TradeProfile.vue';
import TechnicianTermsPanel from '@/components/TechnicianTermsPanel.vue';
import TechnicianAvailabilityPanel from '@/components/technician/TechnicianAvailabilityPanel.vue';
import { computed } from 'vue';
import { Wrench, Handshake, UserRound, ArrowRight } from '@lucide/vue';
import { useAuth } from '@/composables/useAuth';
import { useMaintenanceStore } from '@/stores/maintenance';
const { t } = useLocale();
const { user } = useAuth();
const data = useMaintenanceStore();
const accessibleAssigned = computed(() => data.reports.filter(report => report.assignedTechnicianId === user.value?.id));
</script>
<template>
  <section class="welcome-banner"><div class="welcome-copy"><h1>{{ user?.firstName ? t('Your technician workspace, {name}', { name: user.firstName }) : t('Your technician workspace') }}</h1><p>{{ t("Your skills. Your choice of sites.") }}</p></div><Wrench :size="43" /></section>
  <TradeProfile />
  <TechnicianTermsPanel />
  <TechnicianAvailabilityPanel />
  <div class="technician-grid"><section class="dashboard-card"><span class="stat-icon mint"><UserRound :size="28" /></span><h2>{{ t("Independent by default") }}</h2><p>{{ t("New technician accounts start without a site or any site contracts. A contract is optional; you can keep your account without signing one.") }}</p><RouterLink to="/profile" class="text-action">{{ t("View your account") }} <ArrowRight :size="15" /></RouterLink></section><section class="dashboard-card"><span class="stat-icon citron"><Handshake :size="28" /></span><h2>{{ t("Work with a site") }}</h2><p>{{ t("A site contract is a separate agreement approved by a site administrator. It is never created automatically during registration.") }}</p><RouterLink to="/contracts" class="text-action">{{ t("Site contract options") }} <ArrowRight :size="15" /></RouterLink></section></div>
  <section class="dashboard-card"><h2>{{ t("Assigned work") }}</h2><p v-if="data.loading" class="dialog-intro">{{ t("Loading available work…") }}</p><p v-else-if="data.reportsLoaded" class="dialog-intro">{{ t('{count} reports are assigned to you at {site}.', { count: accessibleAssigned.length, site: data.selectedSite?.name || t('Not available') }) }}</p><p v-else class="dialog-intro">{{ t("No site-scoped work is available to load for this account. Independent marketplace listings and contract-based job access are not available in this version.") }}</p><RouterLink v-if="data.reportsLoaded" to="/assignments" class="text-action">{{ t("View assignments →") }}</RouterLink></section>
</template>
