import { Bell, BellOff } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { StateView } from '@/components/ui/StateView';
import { themeColors } from '@/constants/theme';

/**
 * Notifications placeholder. The web build renders a similar stub from the
 * sidebar bell, and the backend doesn't expose a notifications endpoint yet,
 * so this screen tells the user where to look instead of pretending to be
 * fully functional.
 */
export default function NotificationsScreen() {
  const palette = themeColors();
  return (
    <Screen>
      <View className="px-5 pt-4">
        <StateView
          variant="empty"
          icon={BellOff}
          title="Notifications aren't available yet"
          description="Updates about your reports, assignments, and contracts will land here once the notifications service ships."
        />
        <Card>
          <View className="flex-row items-start gap-3">
            <View className="rounded-lg bg-primary/15 p-2">
              <Bell color={palette.primary} size={18} />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-ink">
                In the meantime
              </Text>
              <Text className="mt-1 text-xs leading-5 text-muted">
                Check the Reports tab for the latest activity. The Recent
                updates section on Home surfaces the most recent changes
                across your reports.
              </Text>
            </View>
          </View>
        </Card>
      </View>
    </Screen>
  );
}
