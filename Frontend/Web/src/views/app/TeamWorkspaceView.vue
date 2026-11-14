<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue';
import { useRoute } from 'vue-router';
import { useAuth } from '@/composables/useAuth';
import { useLocale } from '@/i18n';
const props = defineProps<{ initialTab?: string }>();
const { user } = useAuth();
const { t } = useLocale();
const route = useRoute();
const panels = {
  accounts: defineAsyncComponent(() => import('./TeamAccessView.vue')),
  contracts: defineAsyncComponent(() => import('./ContractsView.vue')),
  rules: defineAsyncComponent(() => import('./SiteRulesView.vue')),
  technicians: defineAsyncComponent(() => import('./TechnicianVerificationReviewView.vue')),
  applications: defineAsyncComponent(() => import('./SiteApplicationsView.vue')),
};
const tabs = computed(() => [
  { id: 'accounts', label: 'Accounts' },
  { id: 'contracts', label: 'Contracts' },
  { id: 'rules', label: 'Site category' },
  ...(user.value?.role === 'super_admin' ? [{ id: 'technicians', label: 'Technicians' }, { id: 'applications', label: 'Site applications' }] : []),
]);
const active = computed(() => {
  const requested = props.initialTab || String(route.query.tab || 'accounts');
  return tabs.value.some(tab => tab.id === requested) ? requested as keyof typeof panels : 'accounts';
});
const technician = computed(() => user.value?.role === 'technician');
</script>
<template>
  <component v-if="technician" :is="panels.contracts" />
  <section v-else class="team-workspace"><header><h1>{{ t('Team') }}</h1><nav :aria-label="t('Team sections')"><RouterLink v-for="tab in tabs" :key="tab.id" :to="{ path: '/team', query: { tab: tab.id } }" :aria-current="active === tab.id ? 'page' : undefined">{{ t(tab.label) }}</RouterLink></nav></header><component :is="panels[active]" /></section>
</template>
<style scoped>
.team-workspace>header{margin-bottom:28px}.team-workspace>header h1{font-size:30px;font-weight:700;line-height:1.3;margin-bottom:20px}.team-workspace>header nav{display:flex;gap:8px;flex-wrap:wrap;padding-bottom:16px;border-bottom:1px solid #dfe7e2}.team-workspace>header a{display:inline-flex;align-items:center;min-height:44px;padding:10px 16px;border:1px solid #cddbd3;border-radius:8px;color:#36574e;background:#fff}.team-workspace>header a[aria-current]{background:#d3f6ef;border-color:#6dbaa8;color:#006f65;font-weight:650}
</style>
