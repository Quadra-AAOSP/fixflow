import { View } from 'react-native';

type ScreenProps = {
  children: React.ReactNode;
  className?: string;
};

export function Screen({ children, className }: ScreenProps) {
  return (
    <View className={`flex-1 bg-background ${className ?? ''}`}>
      {children}
    </View>
  );
}
