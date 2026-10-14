import { Minus, Plus } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { themeColors } from '@/constants/theme';

type QuantityStepperProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
};

/** Inclusive −/+ control used by the shop basket. */
export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  disabled,
}: QuantityStepperProps) {
  const palette = themeColors();
  const canDecrease = !disabled && value > min;
  const canIncrease = !disabled && value < max;

  return (
    <View className="flex-row items-center rounded-lg border border-border bg-card">
      <Pressable
        onPress={() => canDecrease && onChange(value - 1)}
        disabled={!canDecrease}
        accessibilityRole="button"
        accessibilityLabel="Decrease quantity"
        className={`px-3 py-2 ${canDecrease ? 'active:opacity-70' : 'opacity-40'}`}
      >
        <Minus color={palette.ink} size={16} />
      </Pressable>

      <Text className="min-w-8 text-center text-sm font-semibold text-ink">
        {value}
      </Text>

      <Pressable
        onPress={() => canIncrease && onChange(value + 1)}
        disabled={!canIncrease}
        accessibilityRole="button"
        accessibilityLabel="Increase quantity"
        className={`px-3 py-2 ${canIncrease ? 'active:opacity-70' : 'opacity-40'}`}
      >
        <Plus color={palette.ink} size={16} />
      </Pressable>
    </View>
  );
}
