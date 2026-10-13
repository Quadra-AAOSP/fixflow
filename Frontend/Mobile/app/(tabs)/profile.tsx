import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowRight, FileSignature, User } from 'lucide-react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { SiteSwitcher } from '@/components/ui/SiteSwitcher';
import { roleLabels } from '@/constants/access';
import { dashboardColors, themeColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentSite } from '@/stores/site';

/**
 * Read-only account screen. The backend exposes no profile-update endpoint
 * (`AdminUserController` is POST /api/admin/users only — admin provisioning),
 * so there is deliberately no edit affordance here.
 *
 * Mirrors `ProfileView.vue`: avatar + name + email, Role/Site ID/Phone card,
 * then a technician-only contracts card (the web's "Site contracts are
 * optional" panel), then Sign out. The mobile also surfaces a "Working site"
 * card, which the web's sidebar handles differently.
 */
export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { site, sites } = useCurrentSite();
  const palette = themeColors();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  async function doLogout() {
    setLoggingOut(true);
    setLogoutError(null);
    try {
      await logout();
    } catch {
      // Mirrors the web, which surfaces a failed sign-out instead of
      // leaving the user stuck with no feedback.
      setLogoutError('Sign out failed. Please try again.');
    } finally {
      setLoggingOut(false);
    }
  }

  function onLogout() {
    Alert.alert('Sign out', 'You will need to sign in again to continue.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          void doLogout();
        },
      },
    ]);
  }

  return (
    <Screen>
      <ScrollView contentContainerClassName="px-5 pb-12 pt-4">
        <View className="mb-6 items-center">
          <View
            className="mb-3 rounded-full p-4"
            style={{ backgroundColor: dashboardColors.statCoralSoft }}
          >
            <User color={dashboardColors.statCoralDeep} size={36} />
          </View>
          <Text
            className="text-xl font-semibold text-ink"
            style={{ letterSpacing: -0.4 }}
          >
            {user ? `${user.firstName} ${user.lastName}` : 'Profile'}
          </Text>
          {user ? (
            <Text className="mt-1 text-sm text-dashboard-subtitle">
              {user.email}
            </Text>
          ) : null}
          {user ? (
            <View
              className="mt-3 rounded-md px-3 py-1"
              style={{ backgroundColor: dashboardColors.tealSoft }}
            >
              <Text
                className="text-xs font-semibold"
                style={{ color: dashboardColors.teal }}
              >
                {roleLabels[user.role] ?? user.role}
              </Text>
            </View>
          ) : null}
        </View>

        {user ? (
          <Card className="mb-4">
            <InfoRow label="Role" value={roleLabels[user.role] ?? user.role} />
            <InfoRow
              label="Site ID"
              value={user.siteId != null ? String(user.siteId) : '—'}
            />
            {user.phone ? <InfoRow label="Phone" value={user.phone} /> : null}
            {user.email ? <InfoRow label="Email" value={user.email} /> : null}
          </Card>
        ) : null}

        {/* Mobile-only: the "Working site" card. The web surfaces this via
            the sidebar's site selector, but the mobile bottom-bar layout
            doesn't have a dedicated slot, so the site context lives here. */}
        <Card className="mb-4">
          <Text className="mb-2 text-sm font-medium text-dashboard-subtitle">
            Working site
          </Text>
          <SiteSwitcher />
          {site ? (
            <View className="mt-3">
              <InfoRow label="Type" value={site.type} />
              <InfoRow label="Contract" value={site.contractStatus} />
              {site.address ? (
                <InfoRow label="Address" value={site.address} />
              ) : null}
            </View>
          ) : null}
          {sites.length > 1 ? (
            <Text className="mt-3 text-xs text-dashboard-caption">
              Reports, categories, and the report list all follow the site
              selected here.
            </Text>
          ) : null}
        </Card>

        {/* Technician-only: mirrors the web's "Site contracts are optional"
            panel. Independent technicians don't have a site-scoped list of
            contracts, so the panel explains that and points to the contracts
            screen for the application flow. */}
        {user?.role === 'technician' ? (
          <Card className="mb-6">
            <View className="mb-2 flex-row items-center gap-2">
              <FileSignature color={dashboardColors.teal} size={18} />
              <Text
                className="text-[15px] font-semibold text-ink"
                style={{ letterSpacing: -0.3 }}
              >
                Site contracts are optional
              </Text>
            </View>
            <Text className="text-[12px] leading-[1.8] text-dashboard-subtitle">
              Your account ID is {user.id}. Share it with a site administrator
              when arranging a contract. A site ID does not represent your
              contract list.
            </Text>
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push('/more/contracts')}
              className="mt-3 flex-row items-center gap-1 self-start active:opacity-70"
            >
              <Text
                className="text-[11px] font-semibold"
                style={{ color: dashboardColors.teal }}
              >
                View contract options
              </Text>
              <ArrowRight color={dashboardColors.teal} size={13} />
            </Pressable>
          </Card>
        ) : null}

        {loggingOut ? (
          <View className="mb-3 flex-row items-center gap-2">
            <ActivityIndicator color={palette.muted} size="small" />
            <Text className="text-xs text-dashboard-caption">Signing you out…</Text>
          </View>
        ) : null}
        {logoutError ? (
          <Text className="mb-3 text-xs text-tone-danger">{logoutError}</Text>
        ) : null}

        <Button
          label="Sign out"
          variant="secondary"
          onPress={onLogout}
        />
      </ScrollView>
    </Screen>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="mb-3 flex-row items-start justify-between gap-4 last:mb-0">
      <Text className="text-sm text-dashboard-subtitle">{label}</Text>
      <Text className="flex-1 text-right text-sm font-medium text-ink">
        {value}
      </Text>
    </View>
  );
}
