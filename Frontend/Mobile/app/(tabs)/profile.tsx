import { Text, View } from 'react-native';
import { User } from 'lucide-react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { themeColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useState } from 'react';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const palette = themeColors(useColorScheme());
  const [loggingOut, setLoggingOut] = useState(false);

  async function onLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <Screen className="px-5 pt-6">
      <View className="mb-6 items-center">
        <View className="mb-3 rounded-full bg-primary/15 p-4 dark:bg-primary-dark/20">
          <User color={palette.primary} size={36} />
        </View>
        <Text className="text-xl font-semibold text-ink dark:text-ink-dark">
          {user ? `${user.firstName} ${user.lastName}` : 'Profile'}
        </Text>
        {user ? (
          <Text className="mt-1 text-sm text-muted dark:text-muted-dark">
            {user.email}
          </Text>
        ) : null}
      </View>

      {user ? (
        <View className="mb-6 rounded-xl border border-border bg-card p-4 dark:border-border-dark dark:bg-card-dark">
          <InfoRow label="Role" value={user.role} />
          <InfoRow
            label="Site ID"
            value={user.siteId != null ? String(user.siteId) : '—'}
          />
          {user.phone ? <InfoRow label="Phone" value={user.phone} /> : null}
        </View>
      ) : null}

      <Button
        label="Sign out"
        variant="secondary"
        loading={loggingOut}
        onPress={onLogout}
      />
    </Screen>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="mb-3 flex-row items-center justify-between last:mb-0">
      <Text className="text-sm text-muted dark:text-muted-dark">{label}</Text>
      <Text className="text-sm font-medium capitalize text-ink dark:text-ink-dark">
        {value}
      </Text>
    </View>
  );
}
