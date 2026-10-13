import { View } from 'react-native';

type ScreenProps = {
  children: React.ReactNode;
  className?: string;
};

/**
 * In-app screen wrapper. The web's `.dashboard-app` body uses
 * `background: #fcfdfc` (a very faint off-white); that's what we render
 * here. The auth stack has its own `AuthShell` and does not use this
 * component, so the cream auth background is unaffected.
 */
export function Screen({ children, className }: ScreenProps) {
  return <View className={`flex-1 bg-surface ${className ?? ''}`}>{children}</View>;
}
