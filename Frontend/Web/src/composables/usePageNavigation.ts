import { nextTick, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useLocale } from '@/i18n';

const pageTitles: Record<string, string> = {
  landing: 'Little fixes. Better places.',
  'building-suggestions': 'My building suggestions', 'technician-marketplace': 'Find sites hiring',
  'site-rules': 'Site rules', home: 'Dashboard', 'reporter-home': 'My reports', reports: 'Reports', 'new-report': 'New report', 'report-detail': 'Report details',
  sites: 'Sites', 'site-detail': 'Site details', subsites: 'Buildings & locations', assignments: 'Assignments', technician: 'My workspace',
  'team-access': 'Team access', contracts: 'Site contracts',
  team: 'Team', settings: 'Settings', profile: 'Profile', 'admin-application': 'Your application', 'application-access': 'Your application', login: 'Sign in', register: 'Create an account',
  'access-policy': 'Access requirements', 'shop-order': 'Order details', shop: 'Shop', 'shop-management': 'Product management',
};

export function usePageNavigation() {
  const route = useRoute();
  const { locale, t } = useLocale();
  watch([() => route.name, locale], () => {
    const title = typeof route.name === 'string' ? pageTitles[route.name] : undefined;
    document.title = title ? `${t(title)} · FixFlow` : 'FixFlow';
  }, { immediate: true });
  // Query filters retain their current control focus; a new page starts at its content landmark.
  watch(() => route.path, async () => {
    await nextTick();
    document.getElementById('main-content')?.focus({ preventScroll: true });
  }, { flush: 'post' });
}
