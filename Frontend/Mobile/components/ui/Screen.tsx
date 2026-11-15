import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ScreenProps = {
  children: React.ReactNode;
  className?: string;
  /**
   * Pad below the status bar / notch / Dynamic Island.
   * Use on screens that hide the native header and draw their own chrome
   * (`headerShown: false`). Leave off when a stack/tab header is already
   * clearing the top inset — otherwise content gets a double gap.
   */
  safeTop?: boolean;
};

/**
 * In-app screen wrapper. The web's `.dashboard-app` body uses
 * `background: #fcfdfc` (a very faint off-white); that's what we render
 * here. The auth stack has its own `AuthShell` and does not use this
 * component, so the cream auth background is unaffected.
 */
export function Screen({ children, className, safeTop = false }: ScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className={`flex-1 bg-surface ${className ?? ''}`}
      style={safeTop ? { paddingTop: insets.top } : undefined}
    >
      {children}
    </View>
  );
}
