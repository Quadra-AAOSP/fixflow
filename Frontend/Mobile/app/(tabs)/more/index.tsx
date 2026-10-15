import { useRouter } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BellRing,
  ClipboardList,
  House,
  LayoutGrid,
  Plug,
  ScanSearch,
  Users,
  type LucideIcon,
} from 'lucide-react-native';

import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { ListRow } from '@/components/ui/ListRow';
import { dashboardColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import {
  canCreateSite,
  canEditSite,
  canProvision,
  canDecideContracts,
  roleLabels,
} from '@/constants/access';

/**
 * "More" tab — the index route of the nested More stack. Surfaces every
 * secondary destination that doesn't justify a permanent bottom-bar slot.
 *
 * There is no direct web counterpart (the web app has a sidebar with all
 * sections visible at once). The mobile app collapses the sidebar's overflow
 * area into this menu so the bottom bar stays at four items.
 *
 * Items are role-aware so the screen stays useful without becoming cluttered
 * for any given account.
 */
export default function MoreScreen() {
  const router = useRouter();
  const { user } = useAuth();
  // This route is the only screen in the app with no navigation header at all
  // (the Tabs bar *and* the More stack both hide theirs), so nothing pads for
  // the status bar / notch — the view has to do it itself.
  const insets = useSafeAreaInsets();

  if (!user) return null;

  const showSites = canCreateSite(user.role) || canEditSite(user.role);
  const showTeam = canProvision(user.role);
  const showContracts =
    canDecideContracts(user.role) || user.role === 'technician';

  return (
    <Screen>
      <ScrollView
        contentContainerClassName="px-5"
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: Math.max(insets.bottom, 48),
        }}
      >
        {/* Header — mirrors the dashboard's welcome banner treatment, but
            compressed. The web's sidebar already shows the user's name in
            the topbar, so the mobile puts it here. */}
        <View className="mb-5 flex-row items-center gap-3">
          <View
            className="rounded-xl p-3"
            style={{ backgroundColor: dashboardColors.statMintSoft }}
          >
            <LayoutGrid color={dashboardColors.statMintDeep} size={26} />
          </View>
          <View className="flex-1">
            <Text
              className="text-2xl font-bold text-ink"
              style={{ letterSpacing: -0.5 }}
            >
              More
            </Text>
            <Text className="mt-0.5 text-xs text-dashboard-subtitle">
              Signed in as {roleLabels[user.role]}
            </Text>
          </View>
        </View>

        <SectionLabel>Workspace</SectionLabel>
        <Card padded={false} className="mb-6">
          <ListRow
            title="Reports"
            subtitle="Every report at this site."
            icon={ClipboardList}
            className="px-4 py-3"
            onPress={() => router.push('/reports')}
          />
          <View className="mx-4 border-t border-dashboard-card-line" />
          <ListRow
            title="Notifications"
            subtitle="No notifications yet — coming soon."
            icon={BellRing}
            className="px-4 py-3"
            onPress={() => router.push('/more/notifications')}
          />
        </Card>

        {showSites || showTeam || showContracts ? (
          <SectionLabel>Administration</SectionLabel>
        ) : null}
        <Card padded={false} className="mb-6">
          {showSites ? (
            <ListRow
              title="Sites"
              subtitle={
                canCreateSite(user.role)
                  ? 'Create and edit sites.'
                  : 'Edit sites assigned to you.'
              }
              icon={House}
              className="px-4 py-3"
              onPress={() => router.push('/more/sites')}
            />
          ) : null}
          {showSites && showTeam ? (
            <View className="mx-4 border-t border-dashboard-card-line" />
          ) : null}
          {showTeam ? (
            <ListRow
              title="Team access"
              subtitle="Provision staff or admin accounts."
              icon={Users}
              className="px-4 py-3"
              onPress={() => router.push('/more/team-access')}
            />
          ) : null}
          {showContracts ? (
            <>
              {showSites || showTeam ? (
                <View className="mx-4 border-t border-dashboard-card-line" />
              ) : null}
              <ListRow
                title="Site contracts"
                subtitle={
                  user.role === 'technician'
                    ? 'Apply or review contracts.'
                    : 'Record site contracts.'
                }
                icon={Plug}
                className="px-4 py-3"
                onPress={() => router.push('/more/contracts')}
              />
            </>
          ) : null}
        </Card>

        <SectionLabel>Shop</SectionLabel>
        <Card padded={false} className="mb-6">
          <ListRow
            title="Shop"
            subtitle="Browse and order maintenance supplies."
            icon={ScanSearch}
            className="px-4 py-3"
            onPress={() => router.push('/more/shop')}
          />
        </Card>
      </ScrollView>
    </Screen>
  );
}

/**
 * Small teal-tinted section label used above each card on the More menu.
 * Mirrors the section-eyebrow treatment on the web dashboard.
 */
function SectionLabel({ children }: { children: string }) {
  return (
    <View className="mb-2 mt-1 flex-row items-center gap-2 px-1">
      <View
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: dashboardColors.statCitronDeep }}
      />
      <Text
        className="text-[10px] font-semibold uppercase tracking-[1.2px] text-dashboard-subtitle"
        style={{ letterSpacing: 1.2 }}
      >
        {children}
      </Text>
    </View>
  );
}
