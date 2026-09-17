import {
  ActivityIndicator,
  Pressable,
  Text,
  type PressableProps,
} from 'react-native';

type ButtonProps = Omit<PressableProps, 'children'> & {
  label: string;
  variant?: 'primary' | 'secondary';
  loading?: boolean;
  className?: string;
};

export function Button({
  label,
  variant = 'primary',
  loading = false,
  disabled,
  className,
  ...props
}: ButtonProps) {
  const isPrimary = variant === 'primary';
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      className={`min-h-12 flex-row items-center justify-center rounded-lg px-4 py-3 active:opacity-80 ${
        isPrimary
          ? 'bg-primary dark:bg-primary-dark'
          : 'border border-border bg-card dark:border-border-dark dark:bg-card-dark'
      } ${isDisabled ? 'opacity-50' : ''} ${className ?? ''}`}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          color={isPrimary ? '#F0FDFA' : '#0F766E'}
          className="mr-2"
        />
      ) : null}
      <Text
        className={`text-base font-semibold ${
          isPrimary
            ? 'text-primary-foreground dark:text-surface-dark'
            : 'text-ink dark:text-ink-dark'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
