import type { ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

export type RingSegment = {
  value: number;
  color: string;
};

/**
 * Donut chart built from plain circles. Zero-width segments are skipped so a
 * fully-resolved ring stays a single continuous arc.
 */
export function ProgressRing({
  segments,
  size = 104,
  thickness = 9,
  trackColor,
  children,
}: {
  segments: RingSegment[];
  size?: number;
  thickness?: number;
  trackColor: string;
  children?: ReactNode;
}) {
  const radius = (size - thickness) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  let consumed = 0;

  return (
    <View style={{ width: size, height: size }}>
      <Svg
        width={size}
        height={size}
        style={{ transform: [{ rotate: '-90deg' }] }}
      >
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={trackColor}
          strokeWidth={thickness}
          fill="none"
        />
        {total > 0
          ? segments
              .filter((segment) => segment.value > 0)
              .map((segment, index) => {
                const length = (segment.value / total) * circumference;
                const offset = consumed;
                consumed += length;
                return (
                  <Circle
                    key={index}
                    cx={center}
                    cy={center}
                    r={radius}
                    stroke={segment.color}
                    strokeWidth={thickness}
                    fill="none"
                    strokeDasharray={`${length} ${circumference - length}`}
                    strokeDashoffset={-offset}
                  />
                );
              })
          : null}
      </Svg>
      {children ? (
        <View className="absolute inset-0 items-center justify-center">
          {children}
        </View>
      ) : null}
    </View>
  );
}
