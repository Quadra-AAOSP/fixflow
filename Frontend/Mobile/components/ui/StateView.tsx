import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
} from 'react-native';

import { colors } from '@/constants/theme';

type StateViewVariant = 'loading' | 'error' | 'empty';

type StateViewProps = {
  variant: StateViewVariant;
  title?: string;
  description?: string;
  icon?: React.ComponentType<{
    color?: string;
    size?: number;
    strokeWidth?: number;
  }>;
  /** Renders a secondary text-action button when paired with `onAction`. */
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
};

/**
 * Single visual language for the three non-content states every data
 * screen has: loading, error (with retry), and empty. Mirrors the web's
 * `.live-empty` / `.live-error` blocks:
 *   - empty   → muted text on the page background, optional action
 *   - error   → soft coral background, navy ink, optional teal retry
 *   - loading → small slate spinner, no chrome
 *
 * The whole component renders the error variant as an inline block
 * (matching the web's `.live-error`) so callers can drop it above a
 * list without changing the list layout.
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
  if (variant === 'error') {
    return (
      <View
        className={`mb-4 rounded-lg px-4 py-3 ${className ?? ''}`}
        style={{ backgroundColor: colors.coralBg }}
      >
        {description ? (
          <Text
            className="text-[12px] leading-[1.7]"
            style={{ color: colors.coralInk }}
          >
            {description}
          </Text>
        ) : null}
        {actionLabel && onAction ? (
          <Pressable
            accessibilityRole="button"
            onPress={onAction}
            className="mt-2 self-start active:opacity-70"
          >
            <Text
              className="text-[12px] font-semibold"
              style={{ color: colors.mintInk }}
            >
              {actionLabel} →
            </Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View
      className={`flex-1 items-center justify-center px-6 py-10 ${
        className ?? ''
      }`}
    >
      {variant === 'loading' ? (
        <ActivityIndicator size="small" color={colors.muted} />
      ) : Icon ? (
        <Icon color={colors.caption} size={36} strokeWidth={1.6} />
      ) : null}

      {title ? (
        <Text className="mt-3 text-center text-[13px] font-semibold text-ink">
          {title}
        </Text>
      ) : null}

      {description ? (
        <Text className="mt-1 text-center text-[11px] leading-[1.7] text-subtitle">
          {description}
        </Text>
      ) : null}

      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          className="mt-3 active:opacity-70"
        >
          <Text
            className="text-[12px] font-semibold"
            style={{ color: colors.mintInk }}
          >
            {actionLabel} →
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
