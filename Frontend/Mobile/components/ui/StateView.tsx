import type { ComponentType } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { themeColors } from '@/constants/theme';

import { Button } from './Button';

type IconComponent = ComponentType<{ color?: string; size?: number }>;

type StateViewVariant = 'loading' | 'error' | 'empty';

type StateViewProps = {
  variant: StateViewVariant;
  title?: string;
  description?: string;
  icon?: IconComponent;
  /** Renders a secondary button when paired with `onAction`. */
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
};

/**
 * Single visual language for the three non-content states every data screen
 * has: loading, error (with retry), and empty. Use this instead of ad-hoc
 * `<Text>` blocks so loading/error treatments stay consistent as screens are
 * added.
 */
export function StateView({
  variant,
  title,
  description,
  icon: Icon,
  actionLabel,
  onAction,
  className,
}: StateViewProps) {
  const palette = themeColors();

  return (
    <View
      className={`flex-1 items-center justify-center px-6 py-12 ${className ?? ''}`}
    >
      {variant === 'loading' ? (
        <ActivityIndicator size="large" color={palette.primary} />
      ) : Icon ? (
        <Icon
          color={variant === 'error' ? palette.tone.danger : palette.muted}
          size={40}
        />
      ) : null}

      {title ? (
        <Text
          className={`mt-3 text-center text-sm font-medium ${
            variant === 'error' ? 'text-tone-danger' : 'text-ink'
          }`}
        >
          {title}
        </Text>
      ) : null}

      {description ? (
        <Text className="mt-1 text-center text-xs text-muted">
          {description}
        </Text>
      ) : null}

      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          variant="secondary"
          onPress={onAction}
          className="mt-4 px-6"
        />
      ) : null}
    </View>
  );
}