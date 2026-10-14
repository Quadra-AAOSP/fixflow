import { Redirect, Stack, useRouter, useSegments } from 'expo-router';
import { DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { useFonts } from 'expo-font';
import { vars } from 'nativewind';
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

import { darkCssVars, themeColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { AuthProvider } from '@/stores/auth';
import { ThemeModeProvider, useThemeMode } from '@/stores/theme';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(auth)',
};

SplashScreen.preventAutoHideAsync();

/** Native dark tokens — applied to the root view so class-based utilities
 *  (`bg-surface`, `text-auth-ink`, …) switch with the theme. Web uses the
 *  document custom-property override in `RootLayoutNav` instead. */
const darkRootStyle = vars(darkCssVars);

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
        <RootLayoutNav />
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

  // Web only: the class-based tokens read from CSS custom properties, so
  // override them on the document root. (Native gets `darkRootStyle` below.)
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const root = document.documentElement;
    if (mode === 'dark') {
      for (const [name, value] of Object.entries(darkCssVars)) {
        root.style.setProperty(name, value);
      }
      root.classList.add('dark');
    } else {
      for (const name of Object.keys(darkCssVars)) {
        root.style.removeProperty(name);
      }
      root.classList.remove('dark');
    }
  }, [mode]);

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
      <View
        className="flex-1"
        style={Platform.OS !== 'web' && mode === 'dark' ? darkRootStyle : undefined}
      >
        <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
        <AuthNavigator />
      </View>
    </ThemeProvider>
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
