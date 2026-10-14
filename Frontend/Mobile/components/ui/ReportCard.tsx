import { Pressable, Text, View } from 'react-native';

import type { Report, Urgency } from '@/types';
import { formatDate } from '@/utils/format';

import { StatusBadge } from './StatusBadge';
import { UrgencyChip } from './UrgencyChip';

type ReportCardProps = {
  report: Report;
  /** Optional site label — used by cross-site lists (assignments). */
  siteName?: string | null;
  onPress: () => void;
};

/**
 * Shared report row. Used by the reports list, the assignments queue and the
 * dashboard's recent list so a report always looks the same everywhere.
 *
 * Mirrors the web's `.report-table` row in card form:
 *   - 11px radius, 1px `#e9edf0` border
 *   - 16px padding
 *   - top row: small uppercase category in slate caption + status pill
 *   - title row: navy ink
 *   - bottom row: urgency chip on the left, `#id · date` on the right
 *   - hover: 80% opacity (instead of the web's border-color teal hover)
 */
export function ReportCard({ report, siteName, onPress }: ReportCardProps) {
  const visibleUrgency: Urgency =
    report.finalUrgency ?? report.aiUrgency ?? report.reporterUrgency;

  return (
    <Pressable
      onPress={onPress}
      className="rounded-[11px] border border-border bg-card p-4 active:opacity-80"
      accessibilityRole="button"
    >
      <View className="mb-2 flex-row items-center justify-between gap-2">
        <Text
          className="flex-1 text-[10px] font-medium uppercase tracking-wide text-subtitle"
          numberOfLines={1}
        >
          {siteName ? `${report.category} · ${siteName}` : report.category}
        </Text>
        <StatusBadge status={report.status} />
      </View>

      <Text className="mb-3 text-[12px] leading-[1.5] text-ink" numberOfLines={3}>
        {report.description}
      </Text>

      <View className="flex-row items-center justify-between">
        <UrgencyChip level={visibleUrgency} />
        <Text className="text-[10px] text-caption">
          #{report.id} · {formatDate(report.createdAt, true)}
        </Text>
      </View>

      {/* `address` and `reporterReason` are server-masked for peer reporters
          and non-assigned technicians. Render only when the API actually
          delivered them, so masked nulls never leak a placeholder row. */}
      {report.address ? (
        <Text className="mt-2 text-[11px] text-subtitle" numberOfLines={2}>
          {report.address}
        </Text>
      ) : null}

      {report.assignedTechnicianId !== null ? (
        <Text className="mt-2 text-[11px] text-subtitle">
          Technician #{report.assignedTechnicianId}
        </Text>
      ) : null}
    </Pressable>
  );
}
