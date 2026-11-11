import { Text, View } from 'react-native';

import { dashboardColors } from '@/constants/theme';

export type PillTone = 'mint' | 'citron' | 'coral' | 'neutral';

const TONES: Record<PillTone, { bg: string; fg: string }> = {
  mint: {
    bg: dashboardColors.statMintSoft,
    fg: dashboardColors.statMintDeep,
  },
  citron: {
    bg: dashboardColors.statCitronSoft,
    fg: dashboardColors.statCitronDeep,
  },
  coral: {
    bg: dashboardColors.statCoralSoft,
    fg: dashboardColors.statCoralDeep,
  },
  neutral: {
    bg: dashboardColors.cardLine,
    fg: dashboardColors.teal,
  },
};

/**
 * Compact status chip used across the admin screens. `mint` reads as
 * positive/approved, `citron` as waiting, `coral` as a problem, `neutral`
 * for anything informational.
 */
export function Pill({
  label,
  tone = 'neutral',
  className,
}: {
  label: string;
  tone?: PillTone;
  className?: string;
}) {
  const palette = TONES[tone];
  return (
    <View
      className={`rounded-full px-2.5 py-1 ${className ?? ''}`}
      style={{ backgroundColor: palette.bg }}
    >
      <Text
        className="text-[10px] font-semibold uppercase"
        style={{ color: palette.fg, letterSpacing: 0.6 }}
      >
        {label}
      </Text>
    </View>
  );
}
