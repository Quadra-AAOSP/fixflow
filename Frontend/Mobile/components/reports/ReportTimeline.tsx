import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { dashboardColors } from '@/constants/theme';
import type { ReportHistoryItem, ReportStatus } from '@/types';
import { relativeTime } from '@/utils/format';
import { statusGroup, statusLabels } from '@/utils/maintenance';

/**
 * Read inside the component: the palette is a set of getters, so a module
 * constant would keep the light-mode inks after the theme flips.
 */
function dotTone(group: 'open' | 'progress' | 'resolved'): string {
  if (group === 'open') return dashboardColors.statCoralDeep;
  if (group === 'progress') return dashboardColors.statMintDeep;
  return dashboardColors.statCitronDeep;
}

/**
 * Vertical history of every status the report has reached. The backend masks
 * the note/actor columns for users who cannot see sensitive details, so masked
 * rows simply render without them.
 */
export function ReportTimeline({ items }: { items: ReportHistoryItem[] }) {
  const { t } = useTranslation('common');
  if (items.length === 0) return null;

  return (
    <Card className="mb-4">
      <View className="px-4 py-3">
        <Text
          className="text-[13px] font-semibold text-ink"
          style={{ letterSpacing: -0.2 }}
        >
          {t('reports.detail.timeline.title')}
        </Text>

        <View className="mt-3">
          {items.map((item, index) => {
            const known = item.toStatus in statusLabels;
            const status = item.toStatus as ReportStatus;
            const dot = known
              ? dotTone(statusGroup(status))
              : dashboardColors.subtitle;
            const label = known
              ? t(statusLabels[status])
              : item.toStatus;
            const isLast = index === items.length - 1;

            return (
              <View key={item.id} className="flex-row">
                <View className="w-5 items-center">
                  <View
                    className="mt-1 h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: dot }}
                  />
                  {isLast ? null : (
                    <View
                      className="my-1 w-px flex-1"
                      style={{ backgroundColor: dashboardColors.bannerBorder }}
                    />
                  )}
                </View>

                <View className={isLast ? 'flex-1' : 'flex-1 pb-4'}>
                  <View className="flex-row items-center gap-2">
                    <Text className="text-[12px] font-semibold text-ink">
                      {label}
                    </Text>
                    {isLast ? (
                      <View
                        className="rounded-full px-1.5 py-0.5"
                        style={{ backgroundColor: dashboardColors.tealSoft }}
                      >
                        <Text
                          className="text-[8.5px] font-semibold"
                          style={{ color: dashboardColors.teal }}
                        >
                          {t('reports.detail.timeline.current')}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text className="mt-0.5 text-[10px] text-dashboard-subtitle">
                    {relativeTime(item.createdAt)}
                  </Text>
                  {item.note ? (
                    <Text className="mt-1 text-[10.5px] leading-[1.5] text-dashboard-subtitle">
                      {item.note}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </Card>
  );
}
