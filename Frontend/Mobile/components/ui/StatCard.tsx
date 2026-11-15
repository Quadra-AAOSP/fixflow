import type { ComponentType } from 'react';
import { Pressable, Text, View } from 'react-native';

import { dashboardColors } from '@/constants/theme';

/**
 * Lucide icons accept `strokeWidth` in addition to `color`/`size`. The wider
 * prop shape lets call sites style icons to match the web's `.stat-card`
 * (`stroke-width="1.7"` in the SVG).
 */
type IconComponent = ComponentType<{
  color?: string;
  size?: number;
  strokeWidth?: number;
}>;

/**
 * Dashboard stat tile. Mirrors the web `.stat-card` in
 * `Frontend/Web/src/styles/dashboard.css` — soft tinted icon disc, a label,
 * a value, and an optional one-line caption underneath (the web's `.note`).
 *
 * Tapping the card is the entry point to the Reports list with the matching
 * filter pre-applied; the selected card shows a teal ring so the user can
 * tell which filter is driving the rest of the dashboard.
 */
export type DashboardStatTone = 'coral' | 'mint' | 'citron' | 'coral-danger';

/**
 * Class names switch through the CSS variables on their own; the icon colour
 * is an inline prop, so it is resolved per render — a module-level map would
 * freeze the light-mode ink into dark mode.
 */
const TONE_CLASSES: Record<DashboardStatTone, { disc: string; value: string }> = {
  coral: {
    disc: 'bg-dashboard-stat-coral-soft',
    value: 'text-dashboard-stat-coral-deep',
  },
  mint: {
    disc: 'bg-dashboard-stat-mint-soft',
    value: 'text-dashboard-stat-mint-deep',
  },
  citron: {
    disc: 'bg-dashboard-stat-citron-soft',
    value: 'text-dashboard-stat-citron-deep',
  },
  'coral-danger': {
    // The web uses the same coral tile for Open and Urgent — they differ
    // only in icon and label, not in the disc wash. Reusing the coral wash
    // keeps the grid visually unified (see `.stat-card .coral` in the
    // dashboard stylesheet).
    disc: 'bg-dashboard-stat-coral-soft',
    value: 'text-dashboard-stat-coral-deep',
  },
};

function toneIconColor(tone: DashboardStatTone): string {
  return tone === 'mint' ? dashboardColors.statMintDeep : tone === 'citron'
    ? dashboardColors.statCitronDeep
    : dashboardColors.statCoralDeep;
}

type StatCardProps = {
  label: string;
  value: number | string;
  tone: DashboardStatTone;
  icon: IconComponent;
  /** Optional sub-line, e.g. "Open, routed, reopened, escalated". */
  note?: string;
  /** Renders a teal ring when this stat is the active filter. */
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  className?: string;
};

export function StatCard({
  label,
  value,
  tone,
  icon: Icon,
  note,
  selected,
  onPress,
  disabled,
  className,
}: StatCardProps) {
  const styles = TONE_CLASSES[tone];
  const iconColor = toneIconColor(tone);

  const body = (
    <View
      className={`grow flex-row items-center gap-3 rounded-xl border px-3.5 py-3 ${
        selected ? 'border-dashboard-teal' : 'border-dashboard-card-line'
      } bg-dashboard-card-bg`}
      style={
        selected
          ? { boxShadow: `0 3px 15px ${dashboardColors.ctaBg}26` }
          : undefined
      }
    >
      <View
        className={`h-12 w-12 items-center justify-center rounded-full ${styles.disc}`}
      >
        <Icon color={iconColor} size={26} strokeWidth={1.7} />
      </View>
      <View className="flex-1">
        <Text
          className="text-[11px] font-medium text-dashboard-subtitle"
          numberOfLines={1}
        >
          {label}
        </Text>
        <Text
          className={`text-[26px] font-bold leading-tight ${styles.value}`}
          numberOfLines={1}
        >
          {value}
        </Text>
        {note ? (
          <Text className="text-[9px] text-dashboard-caption" numberOfLines={2}>
            {note}
          </Text>
        ) : null}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ selected: !!selected, disabled: !!disabled }}
        className={`flex-1 active:opacity-90 ${disabled ? 'opacity-50' : ''} ${
          className ?? ''
        }`}
      >
        {body}
      </Pressable>
    );
  }

  return <View className={`flex-1 ${className ?? ''}`}>{body}</View>;
}
