import { useRouter } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNotificationIndicator } from '@/hooks/useNotificationIndicator';
import { dashboardColors } from '@/constants/theme';

export function HomeNotificationBell() {
  const router = useRouter();
  const hasUnread = useNotificationIndicator();
  const { t } = useTranslation('common');
  return <Pressable accessibilityRole="button" accessibilityLabel={t(hasUnread ? 'home.notifications.unreadAccessibilityLabel' : 'home.notifications.accessibilityLabel')} onPress={() => router.push('/more/notifications')} className="relative min-h-[48px] min-w-[48px] items-center justify-center self-end active:opacity-70">
    {hasUnread && <View testID="notification-unread-indicator" accessible={false} pointerEvents="none" style={{ position: 'absolute', top: 9, right: 9, width: 9, height: 9, borderRadius: 5, backgroundColor: dashboardColors.statCoralDeep }} />}
    <Bell color={dashboardColors.subtitle} size={18} strokeWidth={1.9} />
  </Pressable>;
}
