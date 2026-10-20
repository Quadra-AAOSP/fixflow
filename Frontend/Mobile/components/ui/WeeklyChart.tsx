import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors } from '@/constants/theme';
import type { WeekBucket } from '@/utils/maintenance';

const BAR_AREA_HEIGHT = 96;

/**
 * Stacked bar chart of a week's reports, split by status group.
 *
 * Implemented with plain views — the web build does the same with CSS bars,
 * and a charting dependency would be more surface than this needs.
 */
export function WeeklyChart({ buckets }: { buckets: WeekBucket[] }) {
  const { t } = useTranslation('common');
  const totals = buckets.map((bucket) =>
    bucket.values.reduce((sum, value) => sum + value, 0),
  );
  const max = Math.max(1, ...totals);

  return (
    <View>
      <View className="flex-row items-end justify-between">
        {buckets.map((bucket, index) => {
          const total = totals[index];
          const filled = Math.max(
            total === 0 ? 0 : 6,
            Math.round((total / max) * BAR_AREA_HEIGHT),
          );

          return (
            <View key={bucket.date.toISOString()} className="flex-1 items-center">
              <Text className="mb-1 text-[10px] text-muted">{total}</Text>
              <View
                style={{ height: BAR_AREA_HEIGHT }}
                className="w-6 justify-end overflow-hidden rounded-md bg-border/60"
              >
                <View style={{ height: filled }} className="w-full">
                  {/* Resolved sits at the bottom, then progress, then open —
                      the same read order as the web dashboard. */}
                  <View
                    style={{
                      flex: bucket.values[2],
                      backgroundColor: colors.lime,
                    }}
                  />
                  <View
                    style={{
                      flex: bucket.values[1],
                      backgroundColor: colors.accent,
                    }}
                  />
                  <View
                    style={{
                      flex: bucket.values[0],
                      backgroundColor: colors.primary,
                    }}
                  />
                </View>
              </View>
              <Text className="mt-1.5 text-[10px] text-muted">
                {bucket.label}
              </Text>
            </View>
          );
        })}
      </View>

      <View className="mt-4 flex-row justify-center gap-4">
        <Legend color={colors.primary} label={t('components.weeklyChart.open')} />
        <Legend color={colors.accent} label={t('components.weeklyChart.inProgress')} />
        <Legend color={colors.lime} label={t('components.weeklyChart.resolved')} />
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View style={{ backgroundColor: color }} className="h-2.5 w-2.5 rounded-sm" />
      <Text className="text-[10px] text-muted">{label}</Text>
    </View>
  );
}
