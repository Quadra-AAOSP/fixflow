import Svg, {
  Ellipse,
  Path,
  Rect,
} from 'react-native-svg';

/**
 * Decorative SVG used on the Home welcome banner. 1:1 port of
 * `Frontend/Web/src/components/dashboard/PlantArt.vue` — same path data,
 * same fill colours, same viewBox. Kept here (not inlined) so the two
 * potted-plant scenes can share one source of truth.
 */
export function PlantArt({ size = 130 }: { size?: number }) {
  // The web SVG is 240×210 (slightly wider than tall). The banner reserves a
  // ~170px slot on desktop; on a phone we drop to ~130 to keep the banner
  // single-line.
  const width = (size * 240) / 210;
  return (
    <Svg
      width={width}
      height={size}
      viewBox="0 0 240 210"
      fill="none"
      accessibilityLabel="Potted plants"
      accessibilityRole="image"
    >
      {/* Shadow */}
      <Ellipse cx={113} cy={193} rx={98} ry={13} fill="#E9E9C4" opacity={0.65} />

      {/* Big-leaf plant (left pot) — soft halo behind the leaves */}
      <Path
        d="M75 183C16 161 6 93 35 25c53 23 83 90 40 158Z"
        fill="#DCE279"
        opacity={0.45}
      />

      {/* Stems and branches — terracotta pot */}
      <Path
        d="M111 174c-9-37-1-74 20-111M109 126 76 91M118 100l33-27"
        stroke="#599A78"
        strokeWidth={3}
        strokeLinecap="round"
      />

      {/* Top leaf */}
      <Path
        d="M119 91c-29-31-1-75 47-82-1 40-13 74-47 82Z"
        fill="#58C6A5"
      />
      <Path d="M118 91c13-33 27-54 41-69" stroke="#D6F2C5" strokeWidth={2} />

      {/* Lower-left leaf */}
      <Path
        d="M109 124C79 130 56 110 51 77c37-1 61 15 58 47Z"
        fill="#9DD69C"
      />
      <Path d="m108 123-39-31" stroke="#D9EAC1" strokeWidth={2} />

      {/* Right leaf */}
      <Path
        d="M122 112c-1-27 17-45 42-40-1 26-16 42-42 40Z"
        fill="#7DD5A4"
      />
      <Path d="m121 113 27-28" stroke="#E2F1CA" strokeWidth={2} />

      {/* Pot */}
      <Path d="M91 157h43l-6 38H97l-6-38Z" fill="#E27979" />
      <Rect x={86} y={151} width={53} height={12} rx={4} fill="#F1A59A" />

      {/* Smaller plant (right) */}
      <Path
        d="M176 177c-5-38-3-66 9-94m-11 64-21-19m24-7 22-18"
        stroke="#78AB80"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <Path
        d="M183 94c-22-15-13-39 5-54 17 24 13 45-5 54Z"
        fill="#A5DBA7"
      />
      <Path
        d="M176 144c-22 0-32-15-30-32 20 0 32 12 30 32Z"
        fill="#B2DDB0"
      />
      <Path
        d="M179 123c-1-20 15-34 33-32-2 23-16 35-33 32Z"
        fill="#78C6A0"
      />
      <Path d="M163 172h29l-4 27h-21l-4-27Z" fill="#8C9E95" />
      <Rect x={160} y={169} width={34} height={7} rx={2} fill="#ABB9A4" />
    </Svg>
  );
}
