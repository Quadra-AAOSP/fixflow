import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  /** Trailing content — a link, a small action button, a count. */
  action?: ReactNode;
  className?: string;
};

/** Consistent heading block for every section inside a screen. */
export function SectionHeader({
  title,
  subtitle,
  action,
  className,
}: SectionHeaderProps) {
  return (
    <View
      className={`mb-3 flex-row items-start justify-between gap-3 ${
        className ?? ''
      }`}
    >
      <View className="flex-1">
        <Text className="text-base font-semibold text-ink">{title}</Text>
        {subtitle ? (
          <Text className="mt-0.5 text-xs text-muted">{subtitle}</Text>
        ) : null}
      </View>
      {action}
    </View>
  );
}
