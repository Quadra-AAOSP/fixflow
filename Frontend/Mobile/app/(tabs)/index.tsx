import { Text, View } from 'react-native';
import { Wrench } from 'lucide-react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { UrgencyChip } from '@/components/ui/UrgencyChip';
import { themeColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function HomeScreen() {
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const palette = themeColors(colorScheme);

  return (
    <Screen className="px-5 pt-4">
      <View className="mb-6 flex-row items-center gap-3">
        <View className="rounded-xl bg-primary/15 p-3 dark:bg-primary-dark/20">
          <Wrench color={palette.primary} size={28} />
        </View>
        <View className="flex-1">
          <Text className="text-2xl font-bold text-ink dark:text-ink-dark">
            Hello{user ? `, ${user.firstName}` : ''}
          </Text>
          <Text className="text-sm text-muted dark:text-muted-dark">
            Report and track site maintenance issues
          </Text>
        </View>
      </View>

      <View className="mb-6 rounded-xl border border-border bg-card p-4 dark:border-border-dark dark:bg-card-dark">
        <Text className="mb-3 text-sm font-medium text-muted dark:text-muted-dark">
          Urgency levels
        </Text>
        <View className="flex-row flex-wrap gap-2">
          <UrgencyChip level="low" />
          <UrgencyChip level="medium" />
          <UrgencyChip level="high" />
          <UrgencyChip level="critical" />
        </View>
      </View>

      <Button label="New report" onPress={() => {}} />
      <Text className="mt-3 text-center text-xs text-muted dark:text-muted-dark">
        Report creation comes next.
      </Text>
    </Screen>
  );
}
