<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { House, FileText, MapPin, Users, ShieldCheck, Handshake, Wrench, ShoppingBag, Bell } from '@lucide/vue';
import { useAuth } from '@/composables/useAuth';
import { useMaintenanceStore } from '@/stores/maintenance';
import { canProvision } from '@/constants/access';
import { useLocale } from '@/i18n';
import PlantArt from '@/components/dashboard/PlantArt.vue';
const { user } = useAuth();
const route = useRoute();
const data = useMaintenanceStore();
const { t } = useLocale();
defineEmits<{ navigate: [] }>();
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
</script>
<template>
      <RouterLink to="/" class="dashboard-brand" @click="$emit('navigate')"><span class="leaf-logo"><i /><i /><i /></span><span>FixFlow<small>{{ t("Spaces work better together") }}</small></span></RouterLink>
      <nav :aria-label="t('Main navigation')"><RouterLink v-for="link in links" :key="link.to" :to="link.to" :class="{ selected: ['/', '/technician'].includes(link.to) ? route.path === link.to : route.path.startsWith(link.to) }" @click="$emit('navigate')"><component :is="link.icon" :size="21" />{{ t(link.label) }}</RouterLink></nav>
      <div class="sidebar-garden"><PlantArt /><p>{{ t('Well-maintained spaces create brighter days.') }}</p></div>
      <span class="sidebar-version">{{ t("A little care. A big difference.") }}</span>

</template>
