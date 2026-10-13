import { useRouter } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import {
  BellRing,
  ClipboardList,
  House,
  LayoutGrid,
  Plug,
  ScanSearch,
  Users,
} from 'lucide-react-native';

import { Card } from '@/components/ui/Card';
import { ListRow } from '@/components/ui/ListRow';
import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/hooks/useAuth';
import {
  canCreateSite,
  canEditSite,
  canProvision,
  canDecideContracts,
  roleLabels,
} from '@/constants/access';

/**
 * "More" tab, the index route of the nested More stack. Surfaces every
 * secondary destination that doesn't justify a permanent bottom-bar slot.
 * Mirrors the web sidebar's overflow area so the mobile app exposes the same
 * surfaces.
 *
 * Items are role-aware so the screen stays useful without becoming cluttered
 * for any given account.
 */
export default function MoreScreen() {
  const router = useRouter();
  const { user } = useAuth();

  if (!user) return null;

  const showSites = canCreateSite(user.role) || canEditSite(user.role);
  const showTeam = canProvision(user.role);
  const showContracts =
    canDecideContracts(user.role) || user.role === 'technician';

  return (
    <Screen>
      <ScrollView contentContainerClassName="px-5 pb-12 pt-4">
        <View className="mb-5 flex-row items-center gap-3">
          <View className="rounded-xl bg-primary/15 p-3">
            <LayoutGrid color="#E27996" size={26} />
          </View>
          <View className="flex-1">
            <Text className="text-2xl font-bold text-ink">More</Text>
            <Text className="mt-0.5 text-xs text-muted">
              Signed in as {roleLabels[user.role]}
            </Text>
          </View>
        </View>

        <Text className="mb-2 text-sm font-medium uppercase tracking-wide text-muted">
          Workspace
        </Text>
        <Card padded={false} className="mb-6">
          <ListRow
            title="Reports"
            subtitle="Every report at this site."
            icon={ClipboardList}
            className="px-4 py-3"
            onPress={() => router.push('/reports')}
          />
          <View className="mx-4 border-t border-border" />
          <ListRow
            title="Notifications"
            subtitle="No notifications yet — coming soon."
            icon={BellRing}
            className="px-4 py-3"
            onPress={() => router.push('/more/notifications')}
          />
        </Card>

        {showSites || showTeam || showContracts ? (
          <Text className="mb-2 text-sm font-medium uppercase tracking-wide text-muted">
            Administration
          </Text>
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
            <View className="mx-4 border-t border-border" />
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
                <View className="mx-4 border-t border-border" />
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

        <Text className="mb-2 text-sm font-medium uppercase tracking-wide text-muted">
          Shop
        </Text>
        <Card padded={false} className="mb-6">
          <ListRow
            title="Catalog"
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
