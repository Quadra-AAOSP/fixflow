import { Text, View } from 'react-native';

export type UrgencyLevel = 'low' | 'medium' | 'high' | 'critical';

const containerStyles: Record<UrgencyLevel, string> = {
  low: 'bg-urgency-low/15',
  medium: 'bg-urgency-medium/15',
  high: 'bg-urgency-high/15',
  critical: 'bg-urgency-critical/15',
};

const textStyles: Record<UrgencyLevel, string> = {
  low: 'text-urgency-low',
  medium: 'text-urgency-medium',
  high: 'text-urgency-high',
  critical: 'text-urgency-critical',
};

const urgencyLabels: Record<UrgencyLevel, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

type UrgencyChipProps = {
  level: UrgencyLevel;
};

export function UrgencyChip({ level }: UrgencyChipProps) {
  return (
    <View className={`rounded-md px-2.5 py-1 ${containerStyles[level]}`}>
      <Text className={`text-xs font-semibold ${textStyles[level]}`}>
        {urgencyLabels[level]}
      </Text>
    </View>
  );
}
