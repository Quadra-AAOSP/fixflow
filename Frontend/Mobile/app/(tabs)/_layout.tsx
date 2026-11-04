import {
  ClipboardList,
  House,
  LayoutGrid,
  User,
  Wrench,
} from 'lucide-react-native';
import { Redirect, Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { SiteProvider } from '@/stores/site';
import { themeColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useClientOnlyValue } from '@/hooks/useClientOnlyValue';
import { isTabVisible } from '@/lib/tabAccess';

/**
 * Role-aware bottom tabs.
 *
 * Which four slots a role sees is fixed — home/dashboard → second tab → more
 * → profile. The specific screen filling each slot depends on role. We
 * conditionally render only the screens the role actually needs, with the
 * first visible screen declared first — Expo Router picks the first declared
 * tab as the default route, which gives us the correct landing without a
 * separate redirect guard.
 *
 * This avoids the infinite render loop that happens when both a top-level
 * <Redirect> and tab options with `href: null` fight to mutate the route in
 * the same React cycle.
 */
export default function TabLayout() {
  const palette = themeColors();
  const { user, isLoading } = useAuth();
  const { t } = useTranslation('common');

  if (isLoading || !user) {
    return (
      <SiteProvider>
        <Tabs screenOptions={{ headerShown: false }} />
      </SiteProvider>
    );
  }

  const role = user.role;
  const hasIndex = isTabVisible(role, 'index');
  const hasWorkspace = isTabVisible(role, 'workspace');
  const hasStaffDashboard = isTabVisible(role, 'staff-dashboard');
  const hasReports = isTabVisible(role, 'reports');
  const hasAssignments = isTabVisible(role, 'assignments');
  const hasMore = isTabVisible(role, 'more');
  const hasProfile = isTabVisible(role, 'profile');

  // First visible tab is the role's landing route. If the user is somehow
  // deep-linked to a route outside their set, bounce them home.
  if (hasStaffDashboard) return renderTabs({ first: 'staff-dashboard' });
  if (hasWorkspace) return renderTabs({ first: 'workspace' });
  if (hasIndex) return renderTabs({ first: 'index' });

  // No known home tab for this role — shouldn't happen but guard anyway.
  return (
    <SiteProvider>
      <Redirect href="/(auth)/login" />
    </SiteProvider>
  );

  function renderTabs({ first }: { first: string }) {
    const screens = [
      // Position 1 — home/dashboard (role-specific)
      hasStaffDashboard && {
        name: 'staff-dashboard',
        title: t('tabs.staffDashboard'),
        icon: ClipboardList,
      },
      hasWorkspace && {
        name: 'workspace',
        title: t('tabs.workspace'),
        icon: Wrench,
      },
      hasIndex && {
        name: 'index',
        title: t('tabs.home'),
        icon: House,
      },
      // Position 2 — reports / technician assignments
      hasReports && {
        name: 'reports',
        title: t('tabs.reports'),
        icon: ClipboardList,
        hideHeader: true,
      },
      hasAssignments && {
        name: 'assignments',
        title: t('tabs.assignments'),
        icon: ClipboardList,
        hideHeader: true,
      },
      // Position 3 — more / shop (deep-link into shop for technician/super_admin)
      hasMore && {
        name: 'more',
        title:
          role === 'technician' || role === 'super_admin'
            ? t('tabs.shop')
            : t('tabs.more'),
        icon: LayoutGrid,
        hideHeader: true,
        href:
          role === 'technician' || role === 'super_admin'
            ? '/more/shop'
            : undefined,
      },
      // Position 4 — profile (everyone)
      hasProfile && {
        name: 'profile',
        title: t('tabs.profile'),
        icon: User,
        hideHeader: true,
      },
    ].filter(Boolean) as Array<{
      name: string;
      title: string;
      icon: typeof House;
      hideHeader?: boolean;
      href?: string;
    }>;

    // Bounce if the active path isn't in the role's tab set.
    return (
      <SiteProvider>
        <Tabs
          initialRouteName={first}
          screenOptions={{
            tabBarActiveTintColor: palette.tabIconSelected,
            tabBarInactiveTintColor: palette.tabIconDefault,
            tabBarStyle: {
              backgroundColor: palette.card,
              borderTopColor: palette.border,
            },
            tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
            headerStyle: { backgroundColor: palette.card },
            headerTintColor: palette.ink,
            headerTitleStyle: { fontWeight: '600', fontSize: 16 },
            headerShadowVisible: false,
            headerShown: useClientOnlyValue(false, true),
          }}
        >
          {screens.map((screen) => (
            <Tabs.Screen
              key={screen.name}
              name={screen.name}
              options={{
                ...(screen.hideHeader ? { headerShown: false } : {}),
                ...(screen.href ? { href: screen.href } : {}),
                title: screen.title,
                tabBarIcon: ({ color, size }) => (
                  <screen.icon color={color} size={size} />
                ),
              }}
            />
          ))}
        </Tabs>
      </SiteProvider>
    );
  }
}
