import { Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors } from '@/constants/theme';

type TextFieldProps = TextInputProps & {
  label: string;
  error?: string;
  className?: string;
};

export function TextField({
  label,
  error,
  className,
  ...props
}: TextFieldProps) {
  return (
    <View className={`mb-4 ${className ?? ''}`}>
      <Text className="mb-1.5 text-sm font-medium text-ink">{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        className={`rounded-lg border bg-card px-3 py-3 text-base text-ink ${
          error ? 'border-tone-danger' : 'border-border'
        }`}
        {...props}
      />
      {error ? (
        <Text className="mt-1 text-xs text-tone-danger">{error}</Text>
      ) : null}
    </View>
  );
}
