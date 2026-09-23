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
      <Text className="mb-1.5 text-sm font-medium text-foreground">{label}</Text>
      <TextInput
        placeholderTextColor={colors.mutedForeground}
        className={`rounded-lg border bg-surface px-3 py-3 text-base text-foreground ${
          error ? 'border-error' : 'border-border'
        }`}
        {...props}
      />
      {error ? (
        <Text className="mt-1 text-xs text-error">{error}</Text>
      ) : null}
    </View>
  );
}
