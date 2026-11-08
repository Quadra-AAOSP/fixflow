import { Redirect, Stack, useRouter, useSegments } from 'expo-router';
import { DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { RefreshCw } from 'lucide-react-native';
import { useFonts } from 'expo-font';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
} from '@expo-google-fonts/dm-sans';
import {
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import 'react-native-reanimated';
import '../global.css';
import '@/constants/i18n';

import { themeColors, dashboardColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useConnectivity } from '@/hooks/useConnectivity';
import { AuthProvider } from '@/stores/auth';
import { TechnicianAvailabilityProvider } from '@/stores/availability';
import { ThemeModeProvider, useThemeMode } from '@/stores/theme';
import { ToastProvider } from '@/components/ui/useToastContext';
import { ConnectivityProvider } from '@/stores/connectivity';
import { useTranslation } from 'react-i18next';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(auth)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // DM Sans (body) + Manrope (headings) mirror the web build's typography.
  // SpaceMono is kept for the tab-bar / debug surfaces that already use it.
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <ThemeModeProvider>
      <AuthProvider>
        <TechnicianAvailabilityProvider>
          <ToastProvider>
            <ConnectivityProvider>
              <RootLayoutNav />
            </ConnectivityProvider>
          </ToastProvider>
        </TechnicianAvailabilityProvider>
      </AuthProvider>
    </ThemeModeProvider>
  );
}

function RootLayoutNav() {
  const palette = themeColors();
  const { mode } = useThemeMode();

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(palette.surface);
  }, [palette.surface]);

  const navigationTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: palette.primary,
      background: palette.surface,
      card: palette.card,
      text: palette.ink,
      border: palette.border,
    },
  };

  return (
    <ThemeProvider value={navigationTheme}>
      <View className="flex-1">
        <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
        <OfflineBanner />
        <AuthNavigator />
      </View>
    </ThemeProvider>
  );
}

/**
 * Full-width amber banner at the top of the app when the backend is
 * unreachable. Shows on every screen — users see it immediately instead of
 * waiting for individual API calls to fail. Dismisses automatically when
 * connectivity returns.
 */
function OfflineBanner() {
  const { offline, pendingCount, retry } = useConnectivity();
  const { t } = useTranslation('common');
  if (!offline && pendingCount === 0) return null;

  const background = offline
    ? dashboardColors.statCitronSoft
    : dashboardColors.statMintSoft;
  const ink = offline
    ? dashboardColors.statCitronDeep
    : dashboardColors.statMintDeep;

  return (
    <View
      className="flex-row items-center justify-between px-4 py-2.5"
      style={{ backgroundColor: background }}
    >
      <Text
        className="flex-1 text-[11px] leading-[16px]"
        style={{ color: ink }}
      >
        {offline
          ? pendingCount > 0
            ? t('offlineBanner.offlineWithPending', { count: pendingCount })
            : t('offlineBanner.offlineText')
          : t('offlineBanner.pending', { count: pendingCount })}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('offlineBanner.retry')}
        accessibilityHint={t('offlineBanner.retryHint')}
        onPress={() => void retry()}
        className="ml-3 flex-row items-center gap-1 rounded-md px-2.5 py-1.5 active:opacity-70"
        style={{ backgroundColor: ink + '22' }}
      >
        <RefreshCw color={ink} size={12} strokeWidth={2} />
        <Text className="text-[10px] font-semibold" style={{ color: ink }}>
          {t('offlineBanner.retry')}
        </Text>
      </Pressable>
    </View>
  );
}

function AuthNavigator() {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const palette = themeColors();

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading, segments, router]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }

  if (!isAuthenticated && segments[0] !== '(auth)') {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
