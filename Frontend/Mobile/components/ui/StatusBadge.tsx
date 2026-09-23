import { Text, View } from 'react-native';

import type { ReportStatus } from '@/types';

const containerStyles: Record<ReportStatus, string> = {
  open: 'bg-info/15',
  routed: 'bg-info/15',
  assigned: 'bg-primary/15',
  in_progress: 'bg-primary/15',
  resolved_pending_confirmation: 'bg-warning/15',
  confirmed: 'bg-success/15',
  reopened: 'bg-warning/15',
  escalated: 'bg-error/15',
};

const textStyles: Record<ReportStatus, string> = {
  open: 'text-info',
  routed: 'text-info',
  assigned: 'text-primary',
  in_progress: 'text-primary',
  resolved_pending_confirmation: 'text-warning',
  confirmed: 'text-success',
  reopened: 'text-warning',
  escalated: 'text-error',
};

const labels: Record<ReportStatus, string> = {
  open: 'Open',
  routed: 'Routed',
  assigned: 'Assigned',
  in_progress: 'In progress',
  resolved_pending_confirmation: 'Pending confirmation',
  confirmed: 'Confirmed',
  reopened: 'Reopened',
  escalated: 'Escalated',
};

export function StatusBadge({ status }: { status: ReportStatus }) {
  return (
    <View className={`rounded-md px-2.5 py-1 ${containerStyles[status]}`}>
      <Text className={`text-xs font-semibold ${textStyles[status]}`}>
        {labels[status]}
      </Text>
    </View>
  );
}
