import {
  ClipboardList,
  House,
  LayoutGrid,
  User,
  Wrench,
} from 'lucide-react-native';
import { Redirect, Tabs, usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { SiteProvider } from '@/stores/site';
import { themeColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useClientOnlyValue } from '@/hooks/useClientOnlyValue';
import { isTabVisible, isTechnicianForbiddenRoute } from '@/lib/tabAccess';

/**
 * Role-aware bottom tabs. Mirrors the web sidebar navigation:
 *   - `reporter | admin`                     → Home / Reports / More / Profile
 *   - `staff`                                → Staff Dashboard / Profile
 *   - `technician`                           → Workspace / Assignments / Shop / Profile
 *   - `super_admin`                          → Home / Reports / Shop / Profile
 *
 * For technicians and super_admins the "More" slot is relabeled "Shop" and
 * deep-links straight into the shop catalog — settings/profile functions live
 * under the Profile tab instead.
 */
export default function TabLayout() {
  const palette = themeColors();
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const { t } = useTranslation('common');

  // While auth is hydrating we don't know the role — render a neutral shell so
  // the navigator mounts and the splash screen can hand off cleanly.
  if (isLoading || !user) {
    return (
      <SiteProvider>
        <Tabs screenOptions={{ headerShown: false }} />
      </SiteProvider>
    );
  }

  // Technician accounts have no Home/Reports tab slots. Only bounce them when
  // they are actually sitting on one of those routes (deep link, stale
  // navigation state) — an unconditional <Redirect> would fight the tab
  // navigator on every remount and block Assignments/More/Profile.
  const technicianOnForbiddenRoute = isTechnicianForbiddenRoute(user.role, pathname);

  if (technicianOnForbiddenRoute) {
    return <Redirect href="/(tabs)/workspace" />;
  }

  return (
    <SiteProvider>
      <Tabs
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
        <Tabs.Screen
          name="index"
          options={!isTabVisible(user.role, 'index') ? { href: null } : {
            title: t('tabs.home'),
            tabBarIcon: ({ color, size }) => <House color={color} size={size} />,
          }}
        />

        <Tabs.Screen
          name="reports"
          options={!isTabVisible(user.role, 'reports') ? { href: null } : {
            headerShown: false,
            title: t('tabs.reports'),
            tabBarIcon: ({ color, size }) => <ClipboardList color={color} size={size} />,
          }}
        />

        <Tabs.Screen
          name="workspace"
          options={isTabVisible(user.role, 'workspace') ? {
            title: t('tabs.workspace'),
            tabBarIcon: ({ color, size }) => <Wrench color={color} size={size} />,
          } : { href: null }}
        />

        <Tabs.Screen
          name="assignments"
          options={isTabVisible(user.role, 'assignments') ? {
            title: t('tabs.assignments'),
            tabBarIcon: ({ color, size }) => <ClipboardList color={color} size={size} />,
          } : { href: null }}
        />

        <Tabs.Screen
          name="more"
          options={() => {
            const visible = isTabVisible(user.role, 'more');
            const shopMode = user?.role === 'technician' || user?.role === 'super_admin';
            return {
              headerShown: false,
              title: shopMode ? t('tabs.shop') : t('tabs.more'),
              tabBarIcon: ({ color, size }) => <LayoutGrid color={color} size={size} />,
              href: !visible ? null : shopMode ? '/more/shop' : undefined,
            };
          }}
        />

        <Tabs.Screen
          name="profile"
          options={{
            title: t('tabs.profile'),
            tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
            tabBarAccessibilityLabel: t('tabs.profile'),
            headerShown: false,
          }}
        />

        <Tabs.Screen
          name="staff-dashboard"
          options={() => (
            isTabVisible(user.role, 'staff-dashboard') ? {
              headerShown: false,
              title: t('tabs.staffDashboard'),
              tabBarIcon: ({ color, size }) => <ClipboardList color={color} size={size} />,
            } : { href: null }
          )}
        />
      </Tabs>
    </SiteProvider>
  );
}
