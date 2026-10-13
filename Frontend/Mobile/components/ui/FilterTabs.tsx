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
 * Horizontally scrollable pill filter. Used where the option count is
 * variable (report status buckets, shop categories) — for two or three
 * fixed choices `SegmentedControl` reads better.
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
            className={`rounded-full border px-4 py-2 active:opacity-80 ${
              selected
                ? 'border-primary bg-primary'
                : 'border-border bg-card'
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                selected ? 'text-primary-foreground' : 'text-muted'
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
