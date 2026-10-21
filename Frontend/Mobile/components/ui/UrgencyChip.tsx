import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Urgency } from '@/types';

/**
 * Urgency chip using the same `bg-urgency-low` / `text-urgency-low`
 * (and -medium / -high / -critical) tokens the web uses in
 * `UrgencyChip.vue`:
 *   - low:      warm slate (`#716f68`)
 *   - medium:   sky (`#0ea5e9`)
 *   - high:     amber (`#f59e0b`)
 *   - critical: red (`#dc2626`)
 *
 * The RGB values for those tokens were updated in global.css /
 * theme.ts to match the web's `tailwind.config.js > colors.urgency`.
 */
const containerStyles: Record<Urgency, string> = {
  low: 'bg-urgency-low/15',
  medium: 'bg-urgency-medium/15',
  high: 'bg-urgency-high/15',
  critical: 'bg-urgency-critical/15',
};

const textStyles: Record<Urgency, string> = {
  low: 'text-urgency-low',
  medium: 'text-urgency-medium',
  high: 'text-urgency-high',
  critical: 'text-urgency-critical',
};

const urgencyLabels: Record<Urgency, string> = {
  low: 'labels.urgency.low',
  medium: 'labels.urgency.medium',
  high: 'labels.urgency.high',
  critical: 'labels.urgency.critical',
};

type UrgencyChipProps = {
  level: Urgency;
};

export function UrgencyChip({ level }: UrgencyChipProps) {
  const { t } = useTranslation('common');
  return (
    <View className={`rounded-md px-2.5 py-1 ${containerStyles[level]}`}>
      <Text className={`text-[11px] font-semibold ${textStyles[level]}`}>
        {t(urgencyLabels[level])}
      </Text>
    </View>
  );
}
