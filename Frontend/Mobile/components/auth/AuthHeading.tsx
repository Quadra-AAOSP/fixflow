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
          className="mb-3 mt-4 h-[46px] w-[46px] items-center justify-center rounded-[15px] bg-auth-lime-soft self-start"
          style={{ transform: [{ rotate: '-6deg' }] }}
        >
          <Icon color={authColors.ink} size={21} />
        </View>
      ) : null}

      <Text
        className={`text-[28px] text-auth-ink ${Icon ? '' : 'mt-3'}`}
        style={{ fontFamily: fontFamilies.headBold, letterSpacing: -1 }}
      >
        {title}
        {titleAccent ? <Text className="text-coral">{titleAccent}</Text> : null}
      </Text>

      {description ? (
        <Text className="mb-5 mt-2 max-w-[320px] text-[13px] leading-[21px] text-auth-body">
          {description}
        </Text>
      ) : null}
    </View>
  );
}
