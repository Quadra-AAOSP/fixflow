import { useRouter } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { dashboardColors } from '@/constants/theme';

export function HomeNotificationBell() {
  const router = useRouter();
  const { t } = useTranslation('common');
  return <Pressable accessibilityRole="button" accessibilityLabel={t('home.notifications.accessibilityLabel')} onPress={() => router.push('/more/notifications')} className="h-11 w-11 items-center justify-center self-end active:opacity-70">
    <Bell color={dashboardColors.subtitle} size={18} strokeWidth={1.9} />
  </Pressable>;
}
