import type { ComponentType } from 'react';
import { ChevronRight } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { colors } from '@/constants/theme';

type IconComponent = ComponentType<{
  color?: string;
  size?: number;
  strokeWidth?: number;
}>;

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
 * Navigation row used by the More menu. Renders as a plain container when
 * no `onPress` is supplied so it can double as a static row.
 *
 * Visual:
 *   - 36×36 mint `#d3f6ef` icon disc with a teal `#008d80` glyph
 *   - 13px ink title, 11px slate `#6b7b8f` subtitle
 *   - right chevron in slate muted
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
  const content = (
    <View className="flex-row items-center gap-3">
      {Icon ? (
        <View
          className="h-9 w-9 items-center justify-center rounded-lg"
          style={{ backgroundColor: colors.mintBg }}
        >
          <Icon color={colors.mintInk} size={18} strokeWidth={1.7} />
        </View>
      ) : null}

      <View className="flex-1">
        <Text className="text-[13px] font-semibold text-ink">{title}</Text>
        {subtitle ? (
          <Text className="mt-0.5 text-[11px] text-subtitle">{subtitle}</Text>
        ) : null}
      </View>

      {trailing ? (
        <Text className="text-[11px] text-subtitle">{trailing}</Text>
      ) : null}

      {onPress ? (
        <ChevronRight color={colors.muted} size={18} strokeWidth={1.6} />
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
