import { Bell, BellOff, CheckCheck, ChevronRight } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { StateView } from '@/components/ui/StateView';
import { dashboardColors } from '@/constants/theme';
import { useNotifications } from '@/stores/notifications';
import { relativeTime } from '@/utils/format';

/**
 * Live in-app notification feed. Entries come from `/ws/reports` site events
 * (assignment, reassignment, status change, pending resolution, confirmation)
 * and are scoped to the signed-in account, so the reporter sees the
 * "confirm the fix" alert the two-step resolution flow depends on.
 */
export default function NotificationsScreen() {
  const router = useRouter();
  const { t } = useTranslation('common');
  const { items, unread, markAllRead, clearAll } = useNotifications();

  const toneStyle = (tone: string) =>
    tone === 'warning'
      ? { background: dashboardColors.statCitronSoft, ink: dashboardColors.statCitronDeep }
      : tone === 'success'
        ? { background: dashboardColors.statMintSoft, ink: dashboardColors.statMintDeep }
        : { background: dashboardColors.statCoralSoft, ink: dashboardColors.statCoralDeep };

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
              {t('more.notifications.title')}
            </Text>
            <Text className="mt-0.5 text-xs text-dashboard-subtitle">
              {t('more.notifications.subtitle')}
            </Text>
          </View>
          {unread > 0 ? (
            <View
              className="rounded-full px-2 py-1"
              style={{ backgroundColor: dashboardColors.statCoralSoft }}
            >
              <Text
                className="text-[10px] font-semibold"
                style={{ color: dashboardColors.statCoralDeep }}
              >
                {t('notifications.unreadCount', { count: unread })}
              </Text>
            </View>
          ) : null}
        </View>

        {items.length === 0 ? (
          <StateView
            variant="empty"
            icon={BellOff}
            title={t('more.notifications.emptyTitle')}
            description={t('more.notifications.emptyDesc')}
          />
        ) : (
          <>
            <View className="mb-3 flex-row items-center justify-between">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('notifications.markAllRead')}
                onPress={markAllRead}
                disabled={unread === 0}
                className="flex-row items-center gap-1 rounded-md px-2 py-1.5 active:opacity-70"
                style={{ opacity: unread === 0 ? 0.4 : 1 }}
              >
                <CheckCheck color={dashboardColors.teal} size={14} />
                <Text
                  className="text-[11px] font-semibold"
                  style={{ color: dashboardColors.teal }}
                >
                  {t('notifications.markAllRead')}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('notifications.clearAll')}
                onPress={clearAll}
                className="rounded-md px-2 py-1.5 active:opacity-70"
              >
                <Text className="text-[11px] font-semibold text-dashboard-subtitle">
                  {t('notifications.clearAll')}
                </Text>
              </Pressable>
            </View>

            {items.map((item) => {
              const tone = toneStyle(item.tone);
              return (
                <Card key={item.id} className="mb-2">
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t(item.titleKey)}
                    onPress={() => router.push(`/reports/${item.reportId}`)}
                    className="flex-row items-start gap-3 active:opacity-70"
                  >
                    <View
                      className="rounded-lg p-2"
                      style={{ backgroundColor: tone.background }}
                    >
                      <Bell color={tone.ink} size={16} />
                    </View>
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2">
                        <Text className="flex-1 text-sm font-semibold text-ink">
                          {t(item.titleKey)}
                        </Text>
                        {!item.read ? (
                          <View
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: dashboardColors.statCoralDeep }}
                          />
                        ) : null}
                      </View>
                      <Text className="mt-1 text-xs leading-5 text-dashboard-subtitle">
                        {t(item.bodyKey, { id: item.reportId })}
                      </Text>
                      <Text className="mt-1 text-[10px] text-dashboard-caption">
                        {relativeTime(item.occurredAt)}
                      </Text>
                    </View>
                    <ChevronRight color={dashboardColors.subtitle} size={14} />
                  </Pressable>
                </Card>
              );
            })}
          </>
        )}
      </View>
    </Screen>
  );
}
