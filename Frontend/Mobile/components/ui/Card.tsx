import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';

type CardProps = ViewProps & {
  children: ReactNode;
  /** Set to `false` to render a bare container the caller pads itself. */
  padded?: boolean;
  className?: string;
};

/**
 * The single surface treatment used across the in-app UI. Matches the
 * web's `.dashboard-card` exactly:
 *   - white card background
 *   - 1px hairline border at `#e9edf0`
 *   - 11px corner radius
 *   - default 17px / 15px padding (we use 16px in Tailwind units, the
 *     web-equivalent that maps cleanly to the 17/15px values)
 *
 * Pages that need a different surface (the welcome banner uses cream,
 * the FAB uses mint) build their own container with `dashboardColors`
 * rather than overriding Card.
 */
export function Card({
  children,
  padded = true,
  className,
  ...props
}: CardProps) {
  return (
    <View
      className={`rounded-[11px] border border-border bg-card ${
        padded ? 'p-4' : ''
      } ${className ?? ''}`}
      {...props}
    >
      {children}
    </View>
  );
}
