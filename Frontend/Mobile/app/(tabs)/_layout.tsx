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
 * Role-aware bottom tabs. Four product roles (backend still carries all 6 —
 * staff + shop_manager are treated as super_admin on mobile, per product):
 *
 *   reporter            → Home, Reports, More, Profile
 *   technician          → Workspace, Assignments, More (Shop), Profile
 *   admin (site)        → Home, Reports, More (site mgmt), Profile
 *   super_admin (incl.  → Home (Platform Console), Reports, More (Shop + mgmt),
 *   staff, shop_manager)   Profile
 *
 * We conditionally render only the screens the role actually needs. First
 * visible tab declared = default route (expo-router picks that). This
 * avoids the infinite render loop that happens when both a top-level
 * <Redirect> and tab options with `href: null` fight to mutate the route.
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
  const hasReports = isTabVisible(role, 'reports');
  const hasAssignments = isTabVisible(role, 'assignments');
  const hasMore = isTabVisible(role, 'more');
  const hasProfile = isTabVisible(role, 'profile');

  // First declared tab is the role's default landing.
  const screens = [
    // Position 1 — role-specific Home / Technician Workspace
    hasWorkspace && {
      name: 'workspace',
      title: t('tabs.workspace'),
      icon: Wrench,
    },
    hasIndex && {
      name: 'index',
      title:
        role === 'super_admin' || role === 'staff' || role === 'shop_manager'
          ? t('tabs.platformConsole')
          : t('tabs.home'),
      icon: House,
    },
    // Position 2 — Reports or Technician Assignments
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
    // Position 3 — More (labeled Shop for technician / super_admin family)
    hasMore && {
      name: 'more',
      title:
        role === 'technician'
          ? t('tabs.shop')
          : t('tabs.more'),
      icon: LayoutGrid,
      hideHeader: true,
      // Technician lands straight in shop catalog; everyone else lands
      // in the More hub and picks what they need.
      href: role === 'technician' ? '/more/shop' : undefined,
    },
    // Position 4 — Profile (everyone)
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

  // Defensive — if somehow the role has no visible tabs, bounce to login.
  if (screens.length === 0) {
    return (
      <SiteProvider>
        <Redirect href="/(auth)/login" />
      </SiteProvider>
    );
  }

  const first = screens[0].name;

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
