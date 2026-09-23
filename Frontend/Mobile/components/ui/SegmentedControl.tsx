import { Pressable, Text, View } from 'react-native';

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
};

type SegmentedControlProps<T extends string> = {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
};

/**
 * Lightweight segmented control. Used for small, equal-weight option sets
 * (role picker, urgency picker). For wider selections or variable content
 * use a different control.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <View
      className={`flex-row rounded-md border border-border bg-surface p-1 ${className ?? ''}`}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            className={`flex-1 items-center rounded py-2.5 ${
              selected ? 'bg-primary' : 'bg-transparent'
            }`}
            onPress={() => onChange(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
          >
            <Text
              className={`text-sm font-semibold ${
                selected ? 'text-primary-foreground' : 'text-muted-foreground'
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