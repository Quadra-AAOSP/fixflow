import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { ReportStatus } from '@/types';

/**
 * Status badge colors match the web's `.status-badge` + `statusTone()`:
 * the badge picks one of three soft tones (`coral` / `mint` / `citron`)
 * based on the status **group** (open / progress / resolved), not the
 * individual status. See `Frontend/Web/src/utils/maintenance.ts`:
 *
 *   `statusTone = (status) => ({ open: 'coral', progress: 'mint',
 *      resolved: 'citron' })[statusGroup(status)]`
 *
 * and the CSS in `dashboard.css` (lines 70-72 and 117):
 *
 *   .dashboard-app .coral   { background: #fae4e5; color: #bb5260; }
 *   .dashboard-app .mint    { background: #d2f6ee; color: #008d80; }
 *   .dashboard-app .citron  { background: #edf4b2; color: #688522; }
 *
 * The `escalated` status keeps the coral-danger variant because the
 * backend flags it as overdue, so we want it to read as a warning
 * rather than a neutral group member.
 */
const TONE: Record<ReportStatus, { bg: string; ink: string }> = {
  open: { bg: 'bg-coral-bg', ink: 'text-coral-ink' },
  routed: { bg: 'bg-coral-bg', ink: 'text-coral-ink' },
  assigned: { bg: 'bg-mint-bg', ink: 'text-mint-ink' },
  in_progress: { bg: 'bg-mint-bg', ink: 'text-mint-ink' },
  resolved_pending_confirmation: { bg: 'bg-citron-bg', ink: 'text-citron-ink' },
  confirmed: { bg: 'bg-citron-bg', ink: 'text-citron-ink' },
  reopened: { bg: 'bg-citron-bg', ink: 'text-citron-ink' },
  escalated: { bg: 'bg-coral-bg', ink: 'text-coral-ink' },
};

const LABELS: Record<ReportStatus, string> = {
  open: 'labels.status.open',
  routed: 'labels.status.routed',
  assigned: 'labels.status.assigned',
  in_progress: 'labels.status.in_progress',
  resolved_pending_confirmation: 'labels.status.resolved_pending_confirmation',
  confirmed: 'labels.status.confirmed',
  reopened: 'labels.status.reopened',
  escalated: 'labels.status.escalated',
};

export function StatusBadge({ status }: { status: ReportStatus }) {
  const { t } = useTranslation('common');
  const tone = TONE[status];
  return (
    <View className={`rounded-md px-2.5 py-1 ${tone.bg}`}>
      <Text className={`text-[11px] font-semibold ${tone.ink}`}>
        {t(LABELS[status])}
      </Text>
    </View>
  );
}
