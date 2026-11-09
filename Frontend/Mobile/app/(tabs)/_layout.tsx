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
import { NotificationsProvider } from '@/stores/notifications';
import { themeColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useClientOnlyValue } from '@/hooks/useClientOnlyValue';
import { isTabVisible } from '@/lib/tabAccess';

type TabConfig = {
  name: string;
  visible: boolean;
  title: string;
  icon: typeof House;
  hideHeader?: boolean;
  href?: string;
};

/**
 * Role-aware bottom tabs. Six backend roles — one tab bar per role:
 *
 *   reporter      → Home, Reports,                        Profile
 *   technician    → Workspace,    Assignments,  More(Shop), Profile
 *   staff         → Home, Reports,            More,       Profile
 *   admin         → Home, Reports,            More,       Profile
 *   super_admin   → Home, Reports,            More(Shop+mgmt), Profile
 *   shop_manager  → Home, More(Shop),         Profile    (only 3)
 *
 * EVERY top-level route in this group is declared explicitly. Routes a role
 * cannot see are declared with `href: null` instead of being omitted —
 * expo-router auto-registers any undeclared file/directory in the group as
 * a tab, which is what previously leaked `workspace`, `assignments` and the
 * `technician` stack into the bar for reporters (7 tabs instead of 4).
 *
 * Hidden routes stay mounted so `router.push('/technician/contract-requests')`
 * still works; they simply never occupy a tab slot.
 */
export default function TabLayout() {
  const palette = themeColors();
  const { user, isLoading } = useAuth();
  const { t } = useTranslation('common');
  const headerShown = useClientOnlyValue(false, true);

  if (isLoading || !user) {
    return (
      <SiteProvider>
        <Tabs screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' } }} />
      </SiteProvider>
    );
  }

  const role = user.role;

  // Label per role for the Home tab — tells the user what kind of home it is.
  const homeLabel =
    role === 'super_admin' ? t('tabs.platformConsole')
    : role === 'shop_manager' ? t('tabs.shopConsole')
    : role === 'reporter' ? t('tabs.myReports')
    : t('tabs.dashboard');

  // Fixed slot order: home/dashboard → reports/technician → more → profile.
  // First visible tab is the role's default landing.
  const tabs: TabConfig[] = [
    {
      name: 'workspace',
      visible: isTabVisible(role, 'workspace'),
      title: t('tabs.workspace'),
      icon: Wrench,
      hideHeader: true,
    },
    {
      name: 'index',
      visible: isTabVisible(role, 'index'),
      title: homeLabel,
      icon: House,
    },
    {
      name: 'reports',
      visible: isTabVisible(role, 'reports'),
      title: role === 'staff' ? t('tabs.siteReports') : t('tabs.reports'),
      icon: ClipboardList,
      hideHeader: true,
    },
    {
      name: 'assignments',
      visible: isTabVisible(role, 'assignments'),
      title: t('tabs.assignments'),
      icon: ClipboardList,
      hideHeader: true,
    },
    {
      name: 'more',
      visible: isTabVisible(role, 'more'),
      title: role === 'staff' ? t('tabs.staffTools') : role === 'admin' ? t('tabs.siteTools') : t('tabs.more'),
      icon: LayoutGrid,
      hideHeader: true,
    },
    {
      name: 'profile',
      visible: isTabVisible(role, 'profile'),
      title: t('tabs.profile'),
      icon: User,
      hideHeader: true,
    },
    // Nested stacks — reachable by route push, never a tab slot.
    {
      name: 'technician',
      visible: false,
      title: t('tabs.technician'),
      icon: Wrench,
      hideHeader: true,
    },
  ];

  const visibleTabs = tabs.filter((tab) => tab.visible);

  // Defensive — if somehow the role has no visible tabs, bounce to login.
  if (visibleTabs.length === 0) {
    return (
      <SiteProvider>
        <Redirect href="/(auth)/login" />
      </SiteProvider>
    );
  }

  return (
    <SiteProvider>
      <NotificationsProvider>
        <Tabs
        initialRouteName={visibleTabs[0].name}
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
          headerShown,
        }}
      >
        {tabs.map((tab) => (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            options={{
              // Hidden tabs keep their route but leave the bar.
              href: tab.visible ? tab.href ?? undefined : null,
              ...(tab.hideHeader ? { headerShown: false } : {}),
              title: tab.title,
              tabBarIcon: ({ color, size }) => (
                <tab.icon color={color} size={size} />
              ),
            }}
          />
        ))}
        </Tabs>
      </NotificationsProvider>
    </SiteProvider>
  );
}
