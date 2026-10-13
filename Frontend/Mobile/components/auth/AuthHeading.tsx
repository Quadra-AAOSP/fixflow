import { Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { authColors, fontFamilies } from '@/constants/theme';

type AuthHeadingProps = {
  /** `.form-kicker` — uppercase, letterspaced, 9px. */
  kicker: string;
  title: string;
  /** Trailing glyph rendered in coral, e.g. the "." in "Welcome back." */
  titleAccent?: string;
  description?: string;
  /**
   * `.welcome-symbol` — the pale-lime rotated tile. Only the sign-in screen
   * has one on the web; omit it elsewhere and the block collapses cleanly.
   */
  icon?: LucideIcon;
};

/**
 * The `.login-heading` block that sits above each auth form. Mirrors
 * `LoginView.vue` ("YOUR SPACE, TAKEN CARE OF" + symbol + "Welcome back.") and
 * `RegisterView.vue` ("FIND YOUR PLACE IN FIXFLOW" + "Join your community.").
 */
export function AuthHeading({
  kicker,
  title,
  titleAccent,
  description,
  icon: Icon,
}: AuthHeadingProps) {
  return (
    <View>
      <Text
        className="text-[9px] text-auth-note"
        style={{ fontFamily: fontFamilies.headBold, letterSpacing: 1.6 }}
      >
        {kicker}
      </Text>

      {Icon ? (
        <View
          className="mb-4 mt-6 h-[57px] w-[57px] items-center justify-center rounded-[18px] bg-auth-lime-soft self-start"
          style={{ transform: [{ rotate: '-6deg' }] }}
        >
          <Icon color={authColors.ink} size={25} />
        </View>
      ) : null}

      <Text
        className={`text-[32px] text-auth-ink ${Icon ? '' : 'mt-4'}`}
        style={{ fontFamily: fontFamilies.headBold, letterSpacing: -1.3 }}
      >
        {title}
        {titleAccent ? <Text className="text-coral">{titleAccent}</Text> : null}
      </Text>

      {description ? (
        <Text className="mt-3 mb-7 max-w-[320px] text-[13px] leading-[22px] text-auth-body">
          {description}
        </Text>
      ) : null}
    </View>
  );
}
