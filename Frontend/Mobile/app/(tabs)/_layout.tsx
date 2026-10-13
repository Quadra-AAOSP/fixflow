import {
  ClipboardList,
  House,
  LayoutGrid,
  User,
  Wrench,
} from 'lucide-react-native';
import { Redirect, Tabs, usePathname } from 'expo-router';

import { SiteProvider } from '@/stores/site';
import { themeColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useClientOnlyValue } from '@/hooks/useClientOnlyValue';

/**
 * Role-aware bottom tabs. Mirrors the web sidebar navigation:
 *   - `reporter | staff | admin | super_admin`  → Home / Reports / More / Profile
 *   - `technician`                              → Workspace / Assignments / More / Profile
 *
 * `More` collects every secondary destination (Sites management, Team access,
 * Contracts, Shop, Notifications) so the bottom bar stays at four items while
 * every screen the web app exposes is reachable from the mobile app.
 */
export default function TabLayout() {
  const palette = themeColors();
  const { user, isLoading } = useAuth();
  const pathname = usePathname();

  // While auth is hydrating we don't know the role — render a neutral shell so
  // the navigator mounts and the splash screen can hand off cleanly.
  if (isLoading || !user) {
    return (
      <SiteProvider>
        <Tabs screenOptions={{ headerShown: false }} />
      </SiteProvider>
    );
  }

  const isTechnician = user.role === 'technician';

  // Technician accounts have no Home/Reports tab slots. Only bounce them when
  // they are actually sitting on one of those routes (deep link, stale
  // navigation state) — an unconditional <Redirect> would fight the tab
  // navigator on every remount and block Assignments/More/Profile.
  const technicianOnForbiddenRoute =
    isTechnician && (pathname === '/' || pathname.startsWith('/reports'));

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
          headerStyle: {
            backgroundColor: palette.card,
          },
          headerTintColor: palette.ink,
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
            isTechnician
              ? { href: null }
              : {
                  title: 'Home',
                  tabBarIcon: ({ color, size }) => (
                    <House color={color} size={size} />
                  ),
                }
          }
        />

        <Tabs.Screen
          name="reports"
          options={
            isTechnician
              ? { href: null }
              : {
                  // The nested Reports stack owns its own header so `new` and
                  // `[id]` get back buttons. Leaving this on would double the
                  // headers.
                  headerShown: false,
                  title: 'Reports',
                  tabBarIcon: ({ color, size }) => (
                    <ClipboardList color={color} size={size} />
                  ),
                }
          }
        />

        <Tabs.Screen
          name="workspace"
          options={
            isTechnician
              ? {
                  title: 'Workspace',
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
            isTechnician
              ? {
                  title: 'Assignments',
                  tabBarIcon: ({ color, size }) => (
                    <ClipboardList color={color} size={size} />
                  ),
                }
              : { href: null }
          }
        />

        <Tabs.Screen
          name="more"
          options={{
            title: 'More',
            tabBarIcon: ({ color, size }) => (
              <LayoutGrid color={color} size={size} />
            ),
          }}
        />

        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
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
