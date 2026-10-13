import { ActivityIndicator, Pressable, Text } from 'react-native';

import { authColors, fontFamilies } from '@/constants/theme';

type AuthButtonProps = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
};

/**
 * Auth-panel submit button. The web's shared `Button` renders
 * `bg-primary text-primary-foreground`, and `.auth-form-panel button` then
 * overrides the radius to 10px, the font-size to 13px and the min-height to
 * 49px. Note the label is the page ink on coral — not white — because that is
 * what `primary-foreground` resolves to on the web.
 */
export function AuthButton({
  label,
  onPress,
  loading = false,
  disabled = false,
}: AuthButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      className={`min-h-[49px] w-full flex-row items-center justify-center rounded-[10px] bg-coral px-4 active:opacity-80 ${
        isDisabled ? 'opacity-50' : ''
      }`}
    >
      {loading ? (
        <ActivityIndicator color={authColors.ink} className="mr-2" />
      ) : null}
      <Text
        className="text-[13px] text-auth-ink"
        style={{ fontFamily: fontFamilies.bodySemiBold }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
