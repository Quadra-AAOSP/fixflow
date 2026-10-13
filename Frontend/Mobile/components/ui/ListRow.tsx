import type { ComponentType } from 'react';
import { ChevronRight } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { themeColors } from '@/constants/theme';

type IconComponent = ComponentType<{ color?: string; size?: number }>;

type ListRowProps = {
  title: string;
  subtitle?: string;
  icon?: IconComponent;
  /** Trailing text (a count, a status) rendered before the chevron. */
  trailing?: string;
  onPress?: () => void;
  disabled?: boolean;
  className?: string;
};

/**
 * Navigation row used by the More/quick-action lists. Renders as a plain
 * container when no `onPress` is supplied so it can double as a static row.
 */
export function ListRow({
  title,
  subtitle,
  icon: Icon,
  trailing,
  onPress,
  disabled,
  className,
}: ListRowProps) {
  const palette = themeColors();

  const content = (
    <View className="flex-row items-center gap-3">
      {Icon ? (
        <View className="rounded-lg bg-primary/12 p-2.5">
          <Icon color={palette.primary} size={20} />
        </View>
      ) : null}

      <View className="flex-1">
        <Text className="text-sm font-semibold text-ink">{title}</Text>
        {subtitle ? (
          <Text className="mt-0.5 text-xs text-muted">{subtitle}</Text>
        ) : null}
      </View>

      {trailing ? (
        <Text className="text-xs text-muted">{trailing}</Text>
      ) : null}

      {onPress ? (
        <ChevronRight color={palette.muted} size={18} />
      ) : null}
    </View>
  );

  if (!onPress) {
    return <View className={className}>{content}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      className={`active:opacity-70 ${disabled ? 'opacity-50' : ''} ${
        className ?? ''
      }`}
    >
      {content}
    </Pressable>
  );
}
