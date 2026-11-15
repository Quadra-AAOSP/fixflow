import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { dashboardColors } from '@/constants/theme';
import type { ReportStatus } from '@/types';

const STEPS: ReportStatus[] = [
  'assigned',
  'in_progress',
  'resolved_pending_confirmation',
  'confirmed',
];

/** Report statuses that map onto the four-step work pipeline. `reopened`
    sends the work back to the in-progress step; `escalated` waits at
    assignment until someone picks it up again. */
const TRACKED: ReportStatus[] = [
  'assigned',
  'in_progress',
  'resolved_pending_confirmation',
  'confirmed',
  'reopened',
  'escalated',
];

export function reportWorkTracked(status: ReportStatus) {
  return TRACKED.includes(status);
}

function stepIndex(status: ReportStatus) {
  switch (status) {
    case 'confirmed':
      return 3;
    case 'resolved_pending_confirmation':
      return 2;
    case 'in_progress':
    case 'reopened':
      return 1;
    default:
      return 0;
  }
}

/**
 * Order-style progress tracker for the report work lifecycle:
 * Assigned → In progress → Awaiting confirmation → Confirmed. Rendered at
 * the top of the work card so the technician, the site admin, and the
 * reporter all see the same "where is this fix" state at a glance.
 */
export function ReportWorkProgress({ status }: { status: ReportStatus }) {
  const { t } = useTranslation('common');
  const current = stepIndex(status);
  return (
    <View className="mb-3 rounded-lg px-1 pt-1">
      <View className="flex-row items-start">
        {STEPS.map((step, index) => {
          const done = index < current;
          const active = index === current;
          return (
            <View
              key={step}
              className="flex-row items-start"
              style={{ flex: index < STEPS.length - 1 ? 1 : undefined }}
            >
              <View className="items-center" style={{ width: 76 }}>
                <View
                  className="h-3 w-3 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: done
                      ? dashboardColors.teal
                      : active
                        ? dashboardColors.statCitronSoft
                        : dashboardColors.cardLine,
                  }}
                >
                  {active ? (
                    <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dashboardColors.statCitronDeep }} />
                  ) : null}
                </View>
                <Text
                  className="mt-1 text-center text-[9px] leading-3"
                  numberOfLines={2}
                  style={{
                    color: index <= current ? dashboardColors.teal : dashboardColors.caption,
                    fontWeight: active ? '600' : '400',
                  }}
                >
                  {t(`labels.status.${step}`)}
                </Text>
              </View>
              {index < STEPS.length - 1 ? (
                <View
                  className="mt-1.5 h-0.5 flex-1"
                  style={{ backgroundColor: done ? dashboardColors.teal : dashboardColors.cardLine }}
                />
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}
