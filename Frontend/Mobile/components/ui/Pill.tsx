import { Text, View } from 'react-native';

import { dashboardColors } from '@/constants/theme';

export type PillTone = 'mint' | 'citron' | 'coral' | 'neutral';

/**
 * Resolved per render: the palette values are getters, so a module-level map
 * would bake the light-mode tints in and leave light chips on dark screens.
 */
function pillTone(tone: PillTone): { bg: string; fg: string } {
  switch (tone) {
    case 'mint':
      return { bg: dashboardColors.statMintSoft, fg: dashboardColors.statMintDeep };
    case 'citron':
      return { bg: dashboardColors.statCitronSoft, fg: dashboardColors.statCitronDeep };
    case 'coral':
      return { bg: dashboardColors.statCoralSoft, fg: dashboardColors.statCoralDeep };
    default:
      return { bg: dashboardColors.cardLine, fg: dashboardColors.teal };
  }
}

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
  const palette = pillTone(tone);
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
