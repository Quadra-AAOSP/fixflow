import {
  ActivityIndicator,
  Pressable,
  Text,
  type PressableProps,
} from 'react-native';

import { colors } from '@/constants/theme';

type ButtonProps = Omit<PressableProps, 'children'> & {
  label: string;
  /**
   * - `cta`     → mint primary CTA, matches the web's
   *               `.report-issue-button` (`#79e2cd` bg, `#65d8c1`
   *               border, `#104b45` text). The default for in-app
   *               primary actions.
   * - `primary` → coral primary, used for the auth brand mark and
   *               occasional accent actions.
   * - `secondary` → outlined neutral button on the warm card chrome.
   */
  variant?: 'cta' | 'primary' | 'secondary';
  loading?: boolean;
  className?: string;
};

/**
 * Three-variant button matching the web's primary CTA (mint) + secondary
 * (outlined neutral) + auth coral. The web never uses coral inside the
 * dashboard, so `cta` is the new in-app default — but `primary` stays
 * exported because the auth pages and the brand mark rely on it.
 */
export function Button({
  label,
  variant = 'cta',
  loading = false,
  disabled,
  className,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  // Mint CTA — `bg-dashboard-cta-bg / border-dashboard-cta-border
  // / text-dashboard-cta-text`. Web equivalent:
  //   background: #79e2cd; border: 1px solid #65d8c1; color: #104b45;
  //   border-radius: 11px; padding: 17px 23px; font-weight: 650;
  const ctaClasses =
    'border border-dashboard-cta-border bg-dashboard-cta-bg text-dashboard-cta-text';

  // Coral primary — used by the auth pages' `AuthButton` and a few
  // accent dots. Kept here so the rest of the app can request it
  // explicitly.
  const primaryClasses = 'bg-primary text-primary-foreground';

  // Secondary — outlined on the warm card chrome. Matches the web's
  // `.action-grid button` (`background: #f8f9fb; border: 1px solid
  // #e8ecf0`).
  const secondaryClasses = 'border border-border bg-card text-ink';

  const containerClasses = (() => {
    switch (variant) {
      case 'primary':
        return primaryClasses;
      case 'secondary':
        return secondaryClasses;
      case 'cta':
      default:
        return ctaClasses;
    }
  })();

  const textColor = (() => {
    switch (variant) {
      case 'primary':
        return colors.primaryForeground;
      case 'secondary':
        return colors.ink;
      case 'cta':
      default:
        return 'rgb(16, 75, 69)';
    }
  })();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      className={`min-h-12 flex-row items-center justify-center rounded-[11px] px-5 py-3 active:opacity-80 ${containerClasses} ${
        isDisabled ? 'opacity-50' : ''
      } ${className ?? ''}`}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          color={textColor}
          className="mr-2"
        />
      ) : null}
      <Text
        className={`text-[15px] font-semibold tracking-[-0.1px]`}
        style={{ color: textColor }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
