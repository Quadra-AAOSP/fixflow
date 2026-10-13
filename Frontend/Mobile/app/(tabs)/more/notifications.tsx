import { Bell, BellOff, ArrowRight } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { StateView } from '@/components/ui/StateView';
import { dashboardColors } from '@/constants/theme';

/**
 * Notifications placeholder. The web build renders a similar stub from the
 * sidebar bell, and the backend doesn't expose a notifications endpoint yet,
 * so this screen tells the user where to look instead of pretending to be
 * fully functional — including the web dialog's "View reports" link.
 */
export default function NotificationsScreen() {
  const router = useRouter();
  return (
    <Screen>
      <View className="px-5 pt-4">
        <View className="mb-5 flex-row items-center gap-3">
          <View
            className="rounded-xl p-3"
            style={{ backgroundColor: dashboardColors.statMintSoft }}
          >
            <Bell color={dashboardColors.statMintDeep} size={26} />
          </View>
          <View className="flex-1">
            <Text
              className="text-2xl font-bold text-ink"
              style={{ letterSpacing: -0.5 }}
            >
              Notifications
            </Text>
            <Text className="mt-0.5 text-xs text-dashboard-subtitle">
              Updates about your reports and assignments.
            </Text>
          </View>
        </View>

        <StateView
          variant="empty"
          icon={BellOff}
          title="Notifications aren't available yet"
          description="Updates about your reports, assignments, and contracts will land here once the notifications service ships."
        />
        <Card>
          <View className="flex-row items-start gap-3">
            <View
              className="rounded-lg p-2"
              style={{ backgroundColor: dashboardColors.statMintSoft }}
            >
              <Bell color={dashboardColors.statMintDeep} size={18} />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-ink">
                In the meantime
              </Text>
              <Text className="mt-1 text-xs leading-5 text-dashboard-subtitle">
                Check the Reports tab for the latest activity. The Recent
                updates section on Home surfaces the most recent changes
                across your reports.
              </Text>
              <Pressable
                accessibilityRole="link"
                onPress={() => router.push('/reports')}
                className="mt-2 flex-row items-center gap-1 self-start active:opacity-70"
              >
                <Text
                  className="text-[11px] font-semibold"
                  style={{ color: dashboardColors.teal }}
                >
                  View reports
                </Text>
                <ArrowRight color={dashboardColors.teal} size={13} />
              </Pressable>
            </View>
          </View>
        </Card>
      </View>
    </Screen>
  );
}
