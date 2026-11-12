<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { House, FileText, MapPin, Users, ShieldCheck, Handshake, Wrench, ShoppingBag } from '@lucide/vue';
import { useAuth } from '@/composables/useAuth';
import { useMaintenanceStore } from '@/stores/maintenance';
import { accountHome } from '@/utils/navigation';
import { workspaceNavigation } from '@/utils/workspaceAccess';
import { useLocale } from '@/i18n';
import PlantArt from '@/components/dashboard/PlantArt.vue';
const { user } = useAuth();
const route = useRoute();
const data = useMaintenanceStore();
const { t } = useLocale();
const emit = defineEmits<{ navigate: [] }>();
const icons: Record<string, typeof House> = { home: House, reports: FileText, sites: MapPin, assignments: Users, contracts: Handshake, technician: Wrench, team: ShieldCheck, shop: ShoppingBag, profile: Users };
const navigation = computed(() => workspaceNavigation(user.value, !!data.selectedSite));

function selected(destination: string) {
  if (['/', '/technician', '/reporter'].includes(destination)) return route.path === destination;
  if (destination === '/team') return ['/team', '/team-access', '/site-rules', '/contracts', '/site-applications', '/technician-verifications'].includes(route.path);
  if (destination === '/shop') return route.path === destination || route.path.startsWith('/shop/orders/');
  return route.path === destination || route.path.startsWith(`${destination}/`);
}

function onNavigate() { emit('navigate'); }

</script>
<template>
      <RouterLink :to="accountHome(user)" class="dashboard-brand" @click="onNavigate"><span class="leaf-logo"><i /><i /><i /></span><span>FixFlow<small>{{ t("Spaces work better together") }}</small></span></RouterLink>
      <nav :aria-label="t('Main navigation')">
        <RouterLink v-for="link in navigation.primary" :key="link.to" :to="link.to"
          :class="{ selected: selected(link.to) }" @click="onNavigate">
          <component :is="icons[link.icon]" :size="21" aria-hidden="true" />{{ t(link.label) }}
        </RouterLink>

      </nav>
      <div class="sidebar-garden"><PlantArt /><p>{{ t('Well-maintained spaces create brighter days.') }}</p></div>
      <span class="sidebar-version">{{ t("A little care. A big difference.") }}</span>

</template>
