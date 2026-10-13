import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  /** Trailing content — a link, a small action button, a count. */
  action?: ReactNode;
  className?: string;
};

/**
 * Heading block matching the web's `.card-heading`:
 *   - title: 15px Manrope, navy `#152742`, -0.3px letter-spacing
 *   - subtitle: 11px slate `#6b7b8f` on a 1.7 line-height
 *   - flex row with optional trailing action
 */
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
        <Text
          className="text-[15px] font-semibold text-ink"
          style={{ letterSpacing: -0.3 }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text className="mt-1 text-[11px] leading-[1.7] text-subtitle">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {action}
    </View>
  );
}
