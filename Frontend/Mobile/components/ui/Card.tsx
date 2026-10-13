import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';

type CardProps = ViewProps & {
  children: ReactNode;
  /** Set to `false` to render a bare container the caller pads itself. */
  padded?: boolean;
  className?: string;
};

/**
 * The single surface treatment used across the app: rounded, hairline
 * border, `card` background. Keeps every panel in the product visually
 * identical without repeating the class string.
 */
export function Card({
  children,
  padded = true,
  className,
  ...props
}: CardProps) {
  return (
    <View
      className={`rounded-xl border border-border bg-card ${
        padded ? 'p-4' : ''
      } ${className ?? ''}`}
      {...props}
    >
      {children}
    </View>
  );
}
