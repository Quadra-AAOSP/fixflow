import type { ComponentType, ReactNode } from 'react';
import { Text, View } from 'react-native';

import { dashboardColors } from '@/constants/theme';

type IconComponent = ComponentType<{
  color?: string;
  size?: number;
  strokeWidth?: number;
}>;

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  /** Small uppercase label above the title. */
  kicker?: string;
  /** Glyph rendered in a soft mint disc on the right. */
  icon?: IconComponent;
  /** Extra content under the subtitle (counts, pills, actions). */
  children?: ReactNode;
  className?: string;
};

/**
 * Shared page heading for secondary screens: 24px ink title, 12px slate
 * subtitle, and an optional mint icon disc. Keeps every "more" screen
 * opening with the same rhythm instead of a one-off text block.
 */
export function PageHeader({
  title,
  subtitle,
  kicker,
  icon: Icon,
  children,
  className,
}: PageHeaderProps) {
  return (
    <View
      className={`mb-5 flex-row items-start justify-between gap-3 ${
        className ?? ''
      }`}
    >
      <View className="flex-1">
        {kicker ? (
          <Text
            className="mb-1 text-[10px] font-semibold uppercase"
            style={{
              color: dashboardColors.statMintDeep,
              letterSpacing: 0.8,
            }}
          >
            {kicker}
          </Text>
        ) : null}
        <Text
          className="text-[24px] font-bold text-ink"
          style={{ letterSpacing: -0.6 }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text className="mt-1 text-[12px] leading-[1.7] text-dashboard-subtitle">
            {subtitle}
          </Text>
        ) : null}
        {children ? <View className="mt-2.5">{children}</View> : null}
      </View>
      {Icon ? (
        <View
          className="h-11 w-11 items-center justify-center rounded-full"
          style={{ backgroundColor: dashboardColors.statMintSoft }}
        >
          <Icon
            color={dashboardColors.statMintDeep}
            size={20}
            strokeWidth={1.9}
          />
        </View>
      ) : null}
    </View>
  );
}
