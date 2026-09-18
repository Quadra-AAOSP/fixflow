import { Text, TextInput, View, type TextInputProps } from 'react-native';

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
      <Text className="mb-1.5 text-sm font-medium text-ink dark:text-ink-dark">
        {label}
      </Text>
      <TextInput
        placeholderTextColor="#94A3B8"
        className={`rounded-lg border px-3 py-3 text-base text-ink dark:text-ink-dark ${
          error
            ? 'border-urgency-critical'
            : 'border-border dark:border-border-dark'
        } bg-card dark:bg-card-dark`}
        {...props}
      />
      {error ? (
        <Text className="mt-1 text-xs text-urgency-critical">{error}</Text>
      ) : null}
    </View>
  );
}
