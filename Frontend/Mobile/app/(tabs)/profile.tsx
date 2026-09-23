import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { User, Wrench } from 'lucide-react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { SiteSwitcher } from '@/components/ui/SiteSwitcher';
import { themeColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentSite } from '@/stores/site';
import type { UserRole } from '@/types';

const ROLE_LABELS: Record<UserRole, string> = {
  reporter: 'Reporter',
  technician: 'Technician',
  staff: 'Staff',
  admin: 'Admin',
  super_admin: 'Super admin',
};

/**
 * Account screen. The backend exposes no profile-update endpoint
 * (`AdminUserController` is POST /api/admin/users only — admin provisioning),
 * so there is deliberately no edit affordance here.
 *
 * The one self-service action available to a `technician` is declaring trades
 * (`POST /api/technician-skills`), so that gets an entry point; without it the
 * role has nothing to do (see `app/technician/skills.tsx`).
 */
export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { site, sites } = useCurrentSite();
  const palette = themeColors();
  const [loggingOut, setLoggingOut] = useState(false);

  async function doLogout() {
    setLoggingOut(true);
    try {
      await logout();
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

  const isTechnician = user?.role === 'technician';
  const canManageTechnicianSkills =
    user?.role === 'admin' || user?.role === 'super_admin';
  const showSkillEntry = isTechnician || canManageTechnicianSkills;

  return (
    <Screen>
      <ScrollView contentContainerClassName="px-5 py-6">
        <View className="mb-6 items-center">
          <View className="mb-3 rounded-full bg-primary/15 p-4">
            <User color={palette.primary} size={36} />
          </View>
          <Text className="text-xl font-semibold text-foreground">
            {user ? `${user.firstName} ${user.lastName}` : 'Profile'}
          </Text>
          {user ? (
            <Text className="mt-1 text-sm text-muted-foreground">{user.email}</Text>
          ) : null}
          {user ? (
            <View className="mt-3 rounded-md bg-primary/15 px-3 py-1">
              <Text className="text-xs font-semibold text-primary">
                {ROLE_LABELS[user.role]}
              </Text>
            </View>
          ) : null}
        </View>

        {user ? (
          <View className="mb-6 rounded-xl border border-border bg-surface p-4">
            <Text className="mb-3 text-sm font-medium text-muted-foreground">Account</Text>
            <InfoRow label="Email" value={user.email} />
            {user.phone ? (
              <InfoRow label="Phone" value={user.phone} />
            ) : null}
            {user.address ? (
              <InfoRow label="Address" value={user.address} />
            ) : null}
          </View>
        ) : null}

        <View className="mb-6 rounded-xl border border-border bg-surface p-4">
          <Text className="mb-2 text-sm font-medium text-muted-foreground">
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
            <Text className="mt-3 text-xs text-muted-foreground">
              Reports, categories, and the report list all follow the site
              selected here.
            </Text>
          ) : null}
          {!site && isTechnician ? (
            <Text className="mt-3 text-xs text-muted-foreground">
              No site is linked to your account, which makes you eligible for
              the marketplace pool.
            </Text>
          ) : null}
        </View>

        {showSkillEntry ? (
          <View className="mb-6 rounded-xl border border-border bg-surface p-4">
            <View className="mb-2 flex-row items-center gap-2">
              <Wrench color={palette.primary} size={16} />
              <Text className="text-sm font-medium text-muted-foreground">
                {isTechnician ? 'Your trades' : 'Technician skills'}
              </Text>
            </View>
            <Text className="mb-3 text-xs text-muted-foreground">
              {isTechnician
                ? 'Declare the trades you work on so routing can match you to reports.'
                : 'Record a technician\u2019s trades so routing can match them to reports.'}
            </Text>
            <Button
              label={isTechnician ? 'Manage trades' : 'Add a trade'}
              variant="secondary"
              onPress={() => {
                router.push('/technician/skills');
              }}
            />
          </View>
        ) : null}

        <Button
          label="Sign out"
          variant="secondary"
          loading={loggingOut}
          onPress={onLogout}
        />
      </ScrollView>
    </Screen>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="mb-3 flex-row items-start justify-between gap-4 last:mb-0">
      <Text className="text-sm text-muted-foreground">{label}</Text>
      <Text className="flex-1 text-right text-sm font-medium capitalize text-foreground">
        {value}
      </Text>
    </View>
  );
}
