import {
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextInput as TextInputRef,
} from 'react-native';

import { authColors, fontFamilies } from '@/constants/theme';

type AuthFieldProps = TextInputProps & {
  label: string;
  error?: string;
  className?: string;
  /**
   * Handle to the underlying input, so a caller can chain focus with the
   * keyboard's "next" key (`email` → `password`) or submit from "go".
   */
  inputRef?: React.Ref<TextInputRef>;
};

/**
 * Auth-panel text field. The web overrides its shared `TextField` inside
 * `.auth-form-panel` — label 12px, input 13px on a `#fdfcf9` fill with a 10px
 * radius and a `#e4e3da` hairline — so this mirrors those overrides rather
 * than reusing `components/ui/TextField`.
 *
 * The 48px input height and 16px vertical gap keep every tap target above the
 * 44pt minimum on a phone.
 */
export function AuthField({
  label,
  error,
  className,
  inputRef,
  ...props
}: AuthFieldProps) {
  return (
    <View className={`mb-4 ${className ?? ''}`}>
      <Text
        className="mb-2 text-[12px] text-auth-ink"
        style={{ fontFamily: fontFamilies.bodyMedium }}
      >
        {label}
      </Text>
      <TextInput
        ref={inputRef}
        placeholderTextColor={authColors.note}
        className={`w-full rounded-[10px] border bg-auth-input px-4 py-3.5 text-[13px] text-auth-ink ${
          error ? 'border-urgency-critical' : 'border-auth-line'
        }`}
        style={{ fontFamily: fontFamilies.body }}
        {...props}
      />
      {error ? (
        <Text className="mt-1 text-[11px] text-urgency-critical">{error}</Text>
      ) : null}
    </View>
  );
}
