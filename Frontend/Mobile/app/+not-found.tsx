import { Link, Stack } from 'expo-router';
import { Text, View } from 'react-native';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <View className="flex-1 items-center justify-center bg-surface px-5 dark:bg-surface-dark">
        <Text className="text-xl font-bold text-ink dark:text-ink-dark">
          This screen doesn't exist.
        </Text>
        <Link href="/" className="mt-4 py-3">
          <Text className="text-sm font-medium text-primary dark:text-primary-dark">
            Go to home
          </Text>
        </Link>
      </View>
    </>
  );
}
