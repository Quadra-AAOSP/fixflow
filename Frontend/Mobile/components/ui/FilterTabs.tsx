import { Pressable, ScrollView, Text } from 'react-native';

export type FilterTabOption<T extends string> = {
  value: T;
  label: string;
  /** Optional count rendered next to the label. */
  count?: number;
};

type FilterTabsProps<T extends string> = {
  options: FilterTabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
};

/**
 * Horizontally scrollable pill filter, mirroring the web's pill
 * treatment (the status filter on Reports, the category chips on Shop):
 *   - 8px radius
 *   - selected: teal `#008e82` border, soft mint `#d2f6ef` background,
 *     teal-deep text
 *   - unselected: hairline `#e9edf0` border, white background, slate
 *     muted text
 */
export function FilterTabs<T extends string>({
  options,
  value,
  onChange,
  className,
}: FilterTabsProps<T>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-2 px-1"
      className={className}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            className={`rounded-lg border px-3.5 py-1.5 active:opacity-80 ${
              selected
                ? 'border-dashboard-teal bg-dashboard-teal-soft'
                : 'border-border bg-card'
            }`}
          >
            <Text
              className={`text-[12px] font-semibold ${
                selected ? 'text-dashboard-teal' : 'text-subtitle'
              }`}
            >
              {option.count !== undefined
                ? `${option.label} · ${option.count}`
                : option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
