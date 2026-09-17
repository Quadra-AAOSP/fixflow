import { View } from 'react-native';

type ScreenProps = {
  children: React.ReactNode;
  className?: string;
};

export function Screen({ children, className }: ScreenProps) {
  return (
    <View className={`flex-1 bg-surface dark:bg-surface-dark ${className ?? ''}`}>
      {children}
    </View>
  );
}
