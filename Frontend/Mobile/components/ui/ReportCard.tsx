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
 */
export function ReportCard({ report, siteName, onPress }: ReportCardProps) {
  // final → ai → reporter. `finalUrgency` is set when staff/admin override;
  // otherwise the AI label (when present) wins over the reporter's pick so
  // the platform's classification is what surfaces at a glance.
  const visibleUrgency: Urgency =
    report.finalUrgency ?? report.aiUrgency ?? report.reporterUrgency;

  return (
    <Pressable
      onPress={onPress}
      className="rounded-xl border border-border bg-card p-4 active:opacity-80"
      accessibilityRole="button"
    >
      <View className="mb-2 flex-row items-center justify-between gap-2">
        <Text
          className="flex-1 text-xs font-medium uppercase tracking-wide text-muted"
          numberOfLines={1}
        >
          {siteName ? `${report.category} · ${siteName}` : report.category}
        </Text>
        <StatusBadge status={report.status} />
      </View>

      <Text className="mb-3 text-sm text-ink" numberOfLines={3}>
        {report.description}
      </Text>

      <View className="flex-row items-center justify-between">
        <UrgencyChip level={visibleUrgency} />
        <Text className="text-xs text-muted">
          {formatDate(report.createdAt, true)}
        </Text>
      </View>

      {/* `address` and `reporterReason` are server-masked for peer reporters
          and non-assigned technicians. Render only when the API actually
          delivered them, so masked nulls never leak a placeholder row. */}
      {report.address ? (
        <Text className="mt-2 text-xs text-muted" numberOfLines={2}>
          {report.address}
        </Text>
      ) : null}

      {report.assignedTechnicianId !== null ? (
        <Text className="mt-2 text-xs text-muted">
          Technician #{report.assignedTechnicianId}
        </Text>
      ) : null}
    </Pressable>
  );
}
