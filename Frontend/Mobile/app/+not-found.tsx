import { Link, Stack } from 'expo-router';
import { Text, View } from 'react-native';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <View className="flex-1 items-center justify-center bg-surface px-5">
        <Text className="text-xl font-bold text-ink">
          This screen doesn't exist.
        </Text>
        <Link href="/" className="mt-4 py-3">
          <Text className="text-sm font-medium text-primary">Go to home</Text>
        </Link>
      </View>
    </>
  );
}