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
 *   - `reporter | staff | admin | super_admin`  → Home / Reports / More / Profile
 *   - `technician`                              → Workspace / Assignments / More / Profile
 *
 * `More` collects every secondary destination (Sites management, Team access,
 * Contracts, Shop, Notifications) so the bottom bar stays at four items while
 * every screen the web app exposes is reachable from the mobile app.
 *
 * Chrome matches the web's `.dashboard-app` palette: the active tab uses the
 * mint-ink selected token (`#008d80`), the inactive uses slate muted, the bar
 * background is the warm card with a hairline `#e9edf0` top border.
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

    // Redirect technicians from forbidden routes to their workspace
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
          headerStyle: {
            backgroundColor: palette.card,
          },
          headerTintColor: palette.ink,
          headerTitleStyle: { fontWeight: '600', fontSize: 16 },
          headerShadowVisible: false,
          headerShown: useClientOnlyValue(false, true),
        }}
      >
        {/* Each route is declared exactly once — React Navigation throws
            "Screen names must be unique" if a name repeats, so the previous
            approach of declaring a screen in a role branch *and* again in a
            hidden-routes block was invalid.
            `href: null` hides a route from the bar while keeping it
            navigable by name (the More menu relies on that). The declaration
            order below is shared; hidden entries simply drop out, so
            technicians see Workspace · Assignments · More · Profile and every
            other role sees Home · Reports · More · Profile. */}
        <Tabs.Screen
          name="index"
          options={
            !isTabVisible(user.role, 'index')
              ? { href: null }
              : {
                  title: t('tabs.home'),
                  tabBarIcon: ({ color, size }) => (
                    <House color={color} size={size} />
                  ),
                }
          }
        />

        <Tabs.Screen
          name="reports"
          options={
            !isTabVisible(user.role, 'reports')
              ? { href: null }
              : {
                  // The nested Reports stack owns its own header so `new` and
                  // `[id]` get back buttons. Leaving this on would double the
                  // headers.
                  headerShown: false,
                  title: t('tabs.reports'),
                  tabBarIcon: ({ color, size }) => (
                    <ClipboardList color={color} size={size} />
                  ),
                }
          }
        />

        <Tabs.Screen
          name="workspace"
          options={
            isTabVisible(user.role, 'workspace')
              ? {
                  title: t('tabs.workspace'),
                  tabBarIcon: ({ color, size }) => (
                    <Wrench color={color} size={size} />
                  ),
                }
              : { href: null }
          }
        />

        <Tabs.Screen
          name="assignments"
          options={
            isTabVisible(user.role, 'assignments')
              ? {
                  title: t('tabs.assignments'),
                  tabBarIcon: ({ color, size }) => (
                    <ClipboardList color={color} size={size} />
                  ),
                }
              : { href: null }
          }
        />

        <Tabs.Screen
          name="more"
          options={(
            { tabBarIcon: ({ color, size }) => (
              <LayoutGrid color={color} size={size} />
            ) }
          ) => {
            const isTechnician = user?.role === 'technician';
            const isSuperAdmin = user?.role === 'super_admin';
            return {
              headerShown: false,
              title: isTechnician || isSuperAdmin ? t('tabs.shop') : t('tabs.more'),
              href: isTechnician || isSuperAdmin ? '/more/shop' : undefined,
            };
          }}
        />

        <Tabs.Screen
          name="shop"
          options={{
            headerShown: false,
            title: t('tabs.shop'),
            tabBarIcon: ({ color, size }) => (
              <LayoutGrid color={color} size={size} />
            ),
          }}
          href={null}
        />

        <Tabs.Screen
          name="profile"
          options={{
            title: t('tabs.profile'),
            tabBarIcon: ({ color, size }) => (
              <User color={color} size={size} />
            ),
            tabBarAccessibilityLabel: t('tabs.profile'),
          }}
          // The nested Profile stack owns its own headers (Profile itself
          // plus the Settings screen it now contains), so the tab must not
          // add a second bar above them — same reason `reports` and `more`
          // disable theirs.
          headerShown: false,
          title: t('tabs.profile'),
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        />

        <Tabs.Screen
          name="staff-dashboard"
          options={(
            { tabBarIcon: ({ color, size }) => (
              <ClipboardList color={color} size={size} />
            ) }
          ) => {
            const isStaff = user?.role === 'staff';
            return {
              headerShown: false,
              title: isStaff ? t('tabs.staffDashboard') : undefined,
              href: isStaff ? undefined : null,
            };
          }}
        />
      </Tabs>

      {/* Technician accounts never see the Home/Reports routes — keep their
          navigation tidy by sending them to Workspace whenever they
          accidentally land on a no-tab route. */}
      {technicianOnForbiddenRoute ? <Redirect href="/workspace" /> : null}
    </SiteProvider>
  );
}
