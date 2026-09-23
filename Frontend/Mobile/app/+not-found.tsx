import { Link, Stack } from 'expo-router';
import { Text, View } from 'react-native';

import { StateView } from '@/components/ui/StateView';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <View className="flex-1 bg-background">
        <StateView
          variant="empty"
          title="This screen doesn't exist"
          description="The link may be out of date."
        />
        <View className="items-center pb-12">
          <Link href="/">
            <Text className="text-sm font-medium text-primary">
              Go to home
            </Text>
          </Link>
        </View>
      </View>
    </>
  );
}