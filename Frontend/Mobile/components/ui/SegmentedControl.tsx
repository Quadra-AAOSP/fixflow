import { Pressable, Text, View } from 'react-native';

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
};

type SegmentedControlProps<T extends string> = {
  options: SegmentedOption<T>[];
  /** `null` renders with no segment selected — used when an explicit
      choice is required (e.g. urgency on the new-report form). */
  value: T | null;
  onChange: (value: T) => void;
  className?: string;
};

/**
 * Segmented control matching the web's pill-style toggle:
 *   - 7px corner radius, 1px hairline border
 *   - selected: soft mint `#d3f6ef` background, teal `#008e82` text
 *   - unselected: white background, slate `#6b7b8f` text
 *
 * Used for small, equal-weight option sets (the urgency picker on the
 * new-report form).
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <View
      className={`flex-row rounded-md border border-border bg-card p-1 ${className ?? ''}`}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            className={`flex-1 items-center rounded py-2.5 ${
              selected
                ? 'bg-dashboard-teal-soft'
                : 'bg-transparent'
            }`}
            onPress={() => onChange(option.value)}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
          >
            <Text
              className={`text-[12px] font-semibold ${
                selected ? 'text-dashboard-teal' : 'text-subtitle'
              }`}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
