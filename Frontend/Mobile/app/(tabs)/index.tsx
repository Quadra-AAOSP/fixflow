import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { Wrench } from 'lucide-react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { UrgencyChip } from '@/components/ui/UrgencyChip';
import { themeColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentSite } from '@/stores/site';

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { site, loading: siteLoading, error: siteError } = useCurrentSite();
  const palette = themeColors();

  const siteLine = site
    ? `${site.name} · ${site.type}`
    : siteLoading
      ? 'Loading site…'
      : siteError
        ? 'Could not load site'
        : 'No site linked';

  const canCreate = !!site;

  return (
    <Screen className="px-5 pt-4">
      <View className="mb-6 flex-row items-center gap-3">
        <View className="rounded-xl bg-primary/15 p-3">
          <Wrench color={palette.primary} size={28} />
        </View>
        <View className="flex-1">
          <Text className="text-2xl font-bold text-ink">
            Hello{user ? `, ${user.firstName}` : ''}
          </Text>
          <Text
            className={`text-sm ${siteError ? 'text-tone-danger' : 'text-muted'}`}
          >
            {siteLine}
          </Text>
        </View>
      </View>

      <View className="mb-6 rounded-xl border border-border bg-card p-4">
        <Text className="mb-3 text-sm font-medium text-muted">
          Urgency levels
        </Text>
        <View className="flex-row flex-wrap gap-2">
          <UrgencyChip level="low" />
          <UrgencyChip level="medium" />
          <UrgencyChip level="high" />
          <UrgencyChip level="critical" />
        </View>
      </View>

      <Button
        label={canCreate ? 'New report' : 'Site required'}
        disabled={!canCreate}
        onPress={() => {
          router.push('/reports/new');
        }}
      />
      <Text className="mt-3 text-center text-xs text-muted">
        {canCreate
          ? 'File a maintenance issue at your site.'
          : 'A site must be linked to file reports.'}
      </Text>
    </Screen>
  );
}