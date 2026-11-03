<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { House, FileText, MapPin, Users, ShieldCheck, Handshake, Wrench, ShoppingBag, Bell } from '@lucide/vue';
import { useAuth } from '@/composables/useAuth';
import { useMaintenanceStore } from '@/stores/maintenance';
import { accountHome } from '@/utils/navigation';
import { workspaceLinks } from '@/utils/workspaceAccess';
import { useLocale } from '@/i18n';
import PlantArt from '@/components/dashboard/PlantArt.vue';
const { user } = useAuth();
const route = useRoute();
const data = useMaintenanceStore();
const { t } = useLocale();
defineEmits<{ navigate: [] }>();
const icons: Record<string, typeof House> = { home: House, reports: FileText, sites: MapPin, assignments: Users, contracts: Handshake, technician: Wrench, invitations: Bell, team: ShieldCheck, shop: ShoppingBag, profile: Users };
const links = computed(() => workspaceLinks(user.value, !!data.selectedSite).map(link => ({ ...link, icon: icons[link.icon] })));

</script>
<template>
      <RouterLink :to="accountHome(user)" class="dashboard-brand" @click="$emit('navigate')"><span class="leaf-logo"><i /><i /><i /></span><span>FixFlow<small>{{ t("Spaces work better together") }}</small></span></RouterLink>
      <nav :aria-label="t('Main navigation')"><RouterLink v-for="link in links" :key="link.to" :to="link.to" :class="{ selected: ['/', '/technician', '/reporter'].includes(link.to) ? route.path === link.to : route.path.startsWith(link.to) }" @click="$emit('navigate')"><component :is="link.icon" :size="21" />{{ t(link.label) }}</RouterLink></nav>
      <div class="sidebar-garden"><PlantArt /><p>{{ t('Well-maintained spaces create brighter days.') }}</p></div>
      <span class="sidebar-version">{{ t("A little care. A big difference.") }}</span>

</template>
