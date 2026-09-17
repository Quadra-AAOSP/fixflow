import { Text, View } from 'react-native';
import { ClipboardList } from 'lucide-react-native';

import { Screen } from '@/components/ui/Screen';
import { themeColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function ReportsScreen() {
  const palette = themeColors(useColorScheme());

  return (
    <Screen className="items-center justify-center px-6">
      <ClipboardList color={palette.muted} size={40} />
      <Text className="mt-4 text-lg font-semibold text-ink dark:text-ink-dark">
        Your reports
      </Text>
      <Text className="mt-2 text-center text-sm text-muted dark:text-muted-dark">
        Submitted maintenance reports will appear here.
      </Text>
      <View className="mt-4 rounded-md bg-status-pending/15 px-3 py-1.5">
        <Text className="text-xs font-medium text-status-pending">
          Pending confirmation
        </Text>
      </View>
    </Screen>
  );
}
