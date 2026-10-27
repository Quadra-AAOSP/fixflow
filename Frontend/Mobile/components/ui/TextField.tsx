import { useState, type ReactNode } from 'react';
import {
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { colors } from '@/constants/theme';

type TextFieldProps = TextInputProps & {
  label: string;
  error?: string;
  /**
   * Optional hint rendered under the input in the same way the web's
   * `.field-hint` paragraph does. Long, multi-line hints are common on the
   * Team access screen ("Use a unique passphrase of at least N characters…").
   */
  hint?: ReactNode;
  className?: string;
};

/**
 * Text input matching the web's `.draft-form input`:
 *   - 1px `#dbe5e0` border (close enough to our `#e9edf0` to share a token)
 *   - 8px corner radius
 *   - 11px / 12px padding
 *   - 12px navy text
 *   - 2px mint `#79e2cd` focus ring (`outline-offset: 1px` on the web)
 *   - danger border in the web's `urgency-critical` red on error
 *
 * The web's input has `background: #fff` — same as our `bg-card`. We render
 * the focus ring as a thick `border` swap with a soft mint background so it
 * reads correctly inside native inputs.
 */
export function TextField({
  label,
  error,
  hint,
  className,
  onFocus,
  onBlur,
  ...props
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const showRing = focused && !error;

  return (
    <View className={`mb-4 ${className ?? ''}`}>
      <Text className="mb-1.5 text-[12px] font-medium text-ink">{label}</Text>
      <TextInput
        placeholderTextColor={colors.subtitle}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        className={`rounded-lg border bg-card px-3 py-3 text-[12px] text-ink ${
          error
            ? 'border-tone-danger'
            : showRing
              ? 'border-[1.5px] border-dashboard-cta-bg bg-dashboard-cta-icon-bg'
              : 'border-[1.5px] border-border'
        }`}
        {...props}
      />
      {error ? (
        <Text className="mt-1 text-xs text-tone-danger">{error}</Text>
      ) : hint ? (
        <Text className="mt-1 text-[10px] leading-[1.65] text-subtitle">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
