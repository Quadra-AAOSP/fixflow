import { Link, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { StateView } from '@/components/ui/StateView';

export default function NotFoundScreen() {
  const { t } = useTranslation('common');
  return (
    <>
      <Stack.Screen options={{ title: t('notFound.screenTitle') }} />
      <View className="flex-1 bg-surface">
        <StateView
          variant="empty"
          title={t('notFound.title')}
          description={t('notFound.description')}
        />
        <View className="items-center pb-12">
          <Link href="/">
            <Text className="text-sm font-medium text-primary">
              {t('notFound.goHome')}
            </Text>
          </Link>
        </View>
      </View>
    </>
  );
}