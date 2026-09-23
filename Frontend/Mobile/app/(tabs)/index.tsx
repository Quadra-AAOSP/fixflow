import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { Wrench } from 'lucide-react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { SiteSwitcher } from '@/components/ui/SiteSwitcher';
import { UrgencyChip } from '@/components/ui/UrgencyChip';
import { themeColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentSite } from '@/stores/site';

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { site } = useCurrentSite();
  const palette = themeColors();

  const hasSite = site !== null;
  // `ReportService.create` permits reporter / staff / admin / super_admin and
  // rejects technicians outright, so the form must not be offered to them.
  const roleCanFile = user !== null && user.role !== 'technician';
  const canFile = hasSite && roleCanFile;

  const caption = !hasSite
    ? 'A site must be linked before you can file reports.'
    : !roleCanFile
      ? 'Technician accounts resolve reports rather than file them.'
      : 'File a maintenance issue at your site.';

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
          <SiteSwitcher />
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
        label="New report"
        disabled={!canFile}
        onPress={() => {
          router.push('/reports/new');
        }}
      />
      <Text className="mt-3 text-center text-xs text-muted">{caption}</Text>
    </Screen>
  );
}